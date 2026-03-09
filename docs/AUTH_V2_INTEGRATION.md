# Auth V2 — Anytype-style Key-based Auth

A mnemonic-driven auth flow sitting alongside the existing Supabase
email/password flow. The user never creates a password — their 12-word BIP39
phrase **is** their identity and their credential.

---

## File map

```
apps/web/
├── app/(auth)/
│   ├── v2/
│   │   ├── signup/page.tsx            ← 3-step onboarding (Welcome → Key → Name)
│   │   └── login/page.tsx             ← Key entry → vault access
├── components/
│   └── settings/
│       └── vault-key-section.tsx      ← "Show my Key" settings card (v2 users only)
├── hooks/
│   ├── use-voice-memo-upload.ts       ← voice upload with client-side encryption
│   ├── use-voice-url.ts               ← voice playback with transparent decryption
│   └── use-vault-notes.ts             ← note CRUD with transparent encrypt/decrypt
└── lib/
    └── vault-credentials.ts           ← derivation + localStorage helpers + HKDF key
```

The existing `/signup` and `/login` routes are **untouched**.

---

## How identity derivation works

```
mnemonic (UTF-8, trimmed + lowercased)
  → SHA-256 (Web Crypto API — no extra deps)
  → 32-byte digest
      bytes  0–15 (hex)  →  email:    <hex>@meerkat.vault
      bytes 16–31 (hex)  →  password: <hex>
```

Supabase receives a garbage email/password pair that is completely unlinkable
to the user. The mnemonic is the only thing that can reproduce it.

### Signup flow (3 animated steps)

1. **Welcome** — "I am new here" / "I already have a Key"
2. **Key** — auto-generated 12-word BIP39 mnemonic (128-bit entropy via
   `@scure/bip39`), blurred by default, "Reveal and Copy" button, custom
   meerkat-themed checkbox acknowledgement before proceeding
3. **Name** — display name entry → `supabase.auth.signUp()` with derived
   credentials → `saveMnemonic()` to localStorage → redirect

### Login flow (1 step)

- Password-style input with eye toggle
- `validateMnemonic()` from `@scure/bip39` runs client-side first — catches
  wrong words, wrong word count, and invalid checksum before hitting Supabase
- `supabase.auth.signInWithPassword()` with derived credentials
- `saveMnemonic()` to localStorage → redirect
- "I've lost my Key" surfaces an inline error (no recovery is possible by
  design — the mnemonic is the only key)

---

## Sign-out

`clearVault()` in `lib/vault-credentials.ts` is the single sign-out function
for vault users. It removes all on-device state atomically:

```
clearMnemonic()           → removes "vault_mnemonic" from localStorage
clearProfile()            → removes "vault_profile" from localStorage
clearVaultSessionCookie() → expires the "vault_session" cookie
                          → expires the "vault_profile_name" cookie
```

**Where it is called:**

| Location                                                          | Trigger                                    |
| ----------------------------------------------------------------- | ------------------------------------------ |
| `components/top-nav.tsx` — `handleSignOut()`                      | User clicks "Sign out" in the nav dropdown |
| `components/settings/security-section.tsx` — `handleSignOutAll()` | User clicks "Sign out everywhere"          |

Both call `clearVault()` before `supabase.auth.signOut()` so the vault is
cleared even if the Supabase call fails (e.g. no network).

---

## HKDF encryption key derivation

The mnemonic also drives a deterministic symmetric key used to encrypt all
user content before it is written to IndexedDB or uploaded to Supabase Storage.
The server only ever stores ciphertext.

### Derivation

```
mnemonic (UTF-8, trimmed + lowercased)
  → HKDF-SHA-256
      salt  = empty  (mnemonic entropy is sufficient — RFC 5869 §2.2)
      info  = "meerkat-vault-v1"  (domain separator)
  → 256-bit AES-GCM CryptoKey (non-extractable)
```

The fixed `info` string acts as a domain separator. Future key versions
(`meerkat-vault-v2`, etc.) will derive completely different keys and can
coexist without collision. No random salt is used because:

1. The mnemonic already carries 128 bits of BIP39 entropy.
2. A random salt would have to be stored server-side, breaking cross-device key
   recovery — the whole point of the mnemonic flow.

### API (in `lib/vault-credentials.ts`)

```ts
// Derive from an explicit mnemonic string (used during sign-in/up):
const vaultKey = await deriveVaultKey(mnemonic);

// Convenience: read mnemonic from localStorage and derive in one call.
// Returns null if no vault session is active.
const vaultKey = await loadVaultKey();
```

---

## Voice memo encryption + decryption

### Upload (`hooks/use-voice-memo-upload.ts`)

```
audioBlob (Blob)
  → arrayBuffer() → Uint8Array          (raw audio bytes in memory only)
  → encryptBlob(bytes, vaultKey)        (AES-GCM-256, fresh 12-byte IV per upload)
  → JSON.stringify(EncryptedBlob)       ({ alg, iv, data } — all base64)
  → upload to Supabase Storage          as "denId/userId/timestamp-rand.enc"
```

The `.enc` file extension signals to the playback hook that decryption is
required. If no vault session exists (legacy v1 Supabase user), the raw
audio is uploaded unencrypted as `.webm` — full backward compatibility.

### Playback (`hooks/use-voice-url.ts`)

`useVoiceUrl(voicePath)` handles both formats transparently:

| Path ends with | Behaviour                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `.webm`        | Signs the storage URL and returns it directly — no decryption needed                                    |
| `.enc`         | Signs URL → `fetch()` bytes → `JSON.parse` → `decryptBlob(vaultKey)` → `URL.createObjectURL(plaintext)` |

The return type is `{ url, isDecrypting, error }` (previously `string | null`)
so the UI can show a loading indicator during the decrypt step.

The object URL created for `.enc` blobs is revoked automatically on unmount or
when `voicePath` changes, preventing memory leaks.

```ts
const { url, isDecrypting, error } = useVoiceUrl(memo.blobRef);

if (isDecrypting) return <Spinner />;
if (error) return <ErrorBadge message={error} />;
// url is a safe object URL ready for <audio src={url} />
```

---

## Note content encryption (`hooks/use-vault-notes.ts`)

Notes are stored in the Yjs `Y.Map<NoteData>` inside IndexedDB. The `content`
field is a plain string. `use-vault-notes.ts` wraps the `@meerkat/local-store`
CRUD functions and adds transparent encryption without modifying the package
itself (keeping `@meerkat/local-store` dependency-free from vault logic).

### Storage format

Encrypted notes use a sentinel prefix so the hook can distinguish them from
legacy plaintext notes:

```
plain note:   "Good morning"
encrypted:    "__enc:{\"alg\":\"AES-GCM-256\",\"iv\":\"...\",\"data\":\"...\"}"
```

The `__enc:` prefix cannot appear naturally in normal note content.
Legacy plaintext notes (written before encryption was enabled) are read back
as-is — no migration needed.

### Write path

```
createNote({ content: "Secret thought" })
  → encryptString(content, vaultKey)
  → "__enc:" + JSON.stringify(EncryptedBlob)
  → local-store createNote(denId, { ...input, content: encrypted })
  → returns NoteData with original plaintext content (caller sees plaintext)
```

### Read path

```
Yjs Y.Map fires observer → useAllNotes(denId) returns raw NoteData[]
  → each note.content checked for "__enc:" prefix
      encrypted → JSON.parse → decryptString(blob, vaultKey) → plaintext
      plaintext → returned as-is  (backward compat)
  → setDecryptedNotes(result)   (atomic swap, no flicker)
```

### Graceful degradation

| State                                   | Behaviour                                                              |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Vault session active                    | Notes encrypted on write, decrypted transparently on read              |
| No vault session (v1 user)              | Notes written and read as plain text                                   |
| Vault session cleared after notes exist | Placeholder `"[Encrypted — sign in with your Key to view]"` — no crash |
| Corrupted ciphertext                    | Placeholder `"[Could not decrypt note]"` — no crash                    |

### API

```ts
// Reactive — re-renders on Yjs changes, decrypts before returning:
const notes = useDecryptedAllNotes(denId);

// Imperative CRUD — for event handlers:
const { createNote, updateNote, deleteNote, getAllNotes } =
  useVaultNotes(denId);
```

**Migration for existing components:** replace `useAllNotes(denId)` with
`useDecryptedAllNotes(denId)` and route note writes through `useVaultNotes`
actions instead of calling `@meerkat/local-store` directly.

---

## Settings — "Vault Key" section

`components/settings/vault-key-section.tsx` renders a card in the Settings
page under **Vault Key** (visible to vault/v2 users only).

The card:

- Reads the mnemonic from `localStorage` via `loadMnemonic()` on mount.
- Renders nothing if no vault session exists (v1 Supabase users never see it).
- Displays the 12 words as numbered pills in a 4-column grid.
- Words are **blurred by default** — prevents shoulder-surfing.
- **Reveal** / **Hide** button toggles blur (animated via Framer Motion).
- **Copy phrase** button is disabled until revealed (intentional friction).
- A "Stored on this device only" badge reinforces local-only storage.
- A yellow warning banner explains no server-side recovery is possible.

---

## Security properties

| Property                | Detail                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Server blindness        | Supabase stores only `<hex>@meerkat.vault` / `<hex>` — no link to the real user                 |
| Voice blob encryption   | AES-GCM-256 before upload; `.enc` extension signals ciphertext                                  |
| Note content encryption | AES-GCM-256 before write to IndexedDB; `__enc:` sentinel detects encrypted entries              |
| Key non-extractability  | HKDF-derived `CryptoKey` is `extractable: false` — raw bytes cannot be read from JS             |
| Fresh IV per operation  | `encryptBlob` / `encryptString` generate a new 12-byte random IV on every call                  |
| No recovery path        | Mnemonic lost = account inaccessible — by design                                                |
| Sign-out completeness   | `clearVault()` removes mnemonic, profile, and both cookies atomically                           |
| Cross-device recovery   | Same mnemonic → same HKDF key → can decrypt all existing blobs and notes on any device          |
| Backward compatibility  | Legacy `.webm` blobs and plaintext notes are detected and handled without attempting decryption |

---

## Dependencies

```bash
pnpm add @scure/bip39 --filter @meerkat/web
```

No other new dependencies. HKDF uses the built-in Web Crypto API. Encryption
and decryption use `encryptBlob` / `encryptString` / `decryptBlob` /
`decryptString` from `@meerkat/crypto` (already a workspace dep).

**Import note** — use the `.js` extension or Next.js throws at build time:

```ts
import { wordlist } from "@scure/bip39/wordlists/english.js"; // ✅
import { wordlist } from "@scure/bip39/wordlists/english"; // ❌ module not found
```

---

## Supabase setup

1. **Disable email confirmations** — Auth → Settings → turn off "Enable email
   confirmations". The derived email is fake so confirmation links go nowhere.
2. **No other changes needed** — the flow uses standard `signUp` /
   `signInWithPassword`, so existing RLS policies, triggers, and the `profiles`
   table all work as before.
