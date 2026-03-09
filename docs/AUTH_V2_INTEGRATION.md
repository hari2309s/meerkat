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
│       └── vault-key-section.tsx      ← "Show my Key" settings card
├── hooks/
│   └── use-voice-memo-upload.ts       ← voice upload with client-side encryption
└── lib/
    └── vault-credentials.ts           ← derivation + localStorage helpers + HKDF key
```

The existing `/signup` and `/login` routes are **untouched**.

---

## How it works

### Identity derivation

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

### Persistence

The mnemonic is stored in `localStorage` under `vault_mnemonic` after a
successful sign-in or sign-up. This keeps the user logged in across sessions
on the same device without re-entering their phrase.

---

## Sign-out

`clearVault()` in `lib/vault-credentials.ts` is the single sign-out function
for vault users. It removes all on-device state:

```
clearMnemonic()          → removes "vault_mnemonic" from localStorage
clearProfile()           → removes "vault_profile" from localStorage
clearVaultSessionCookie() → expires the "vault_session" cookie
                          → expires the "vault_profile_name" cookie
```

**Where it is called**:

| Location                                                          | Trigger                                    |
| ----------------------------------------------------------------- | ------------------------------------------ |
| `components/top-nav.tsx` — `handleSignOut()`                      | User clicks "Sign out" in the nav dropdown |
| `components/settings/security-section.tsx` — `handleSignOutAll()` | User clicks "Sign out everywhere"          |

Both call `clearVault()` before calling `supabase.auth.signOut()` so the
vault is cleared even if the Supabase call fails (e.g. no network).

---

## Encryption key derivation (HKDF)

The mnemonic also drives a symmetric encryption key used to protect den/note
data (voice blobs, attachments) before anything is written to Supabase Storage.
The server stores only ciphertext — it can never decrypt user content.

### Derivation

```
mnemonic (UTF-8, trimmed + lowercased)
  → HKDF-SHA-256
      salt  = empty (mnemonic entropy is sufficient — RFC 5869 §2.2)
      info  = "meerkat-vault-v1"  (domain separator)
  → 256-bit AES-GCM CryptoKey (non-extractable)
```

The fixed `info` string acts as a domain separator. Future key versions
(`meerkat-vault-v2`, etc.) will derive completely different keys and can
coexist without collision.

No random salt is used because:

1. The mnemonic already carries 128 bits of BIP39 entropy.
2. A random salt would have to be stored somewhere, breaking cross-device key
   recovery — the whole point of the mnemonic flow.

### API

```ts
// lib/vault-credentials.ts

// Derive from an explicit mnemonic string:
const vaultKey = await deriveVaultKey(mnemonic);

// Convenience: read mnemonic from localStorage and derive in one call.
// Returns null if no vault session is active.
const vaultKey = await loadVaultKey();
```

### Voice memo encryption

`hooks/use-voice-memo-upload.ts` uses `loadVaultKey()` to encrypt audio
before upload:

```
audioBlob (Blob)
  → arrayBuffer() → Uint8Array
  → encryptBlob(bytes, vaultKey)   ← AES-GCM-256, fresh IV per upload
  → JSON.stringify(EncryptedBlob)  ← { alg, iv, data } — all base64
  → upload to Supabase Storage as  "denId/userId/timestamp.enc"
```

The `.enc` file extension signals to the playback hook that decryption is
needed. Legacy unencrypted recordings keep the `.webm` extension — no
migration needed for existing data.

**Fallback for v1 users**: if `loadVaultKey()` returns `null` (no vault
session — the user signed up via the Supabase email/password flow), the raw
audio is uploaded unencrypted as `.webm` exactly as before.

---

## Settings — "Vault Key" section

`components/settings/vault-key-section.tsx` renders a card in the Settings
page under **Vault Key** (nav item added to `settings-page-client.tsx`).

The card:

- Reads the mnemonic from `localStorage` via `loadMnemonic()`.
- Shows nothing if no vault session is active (v1 users never see this section).
- Renders the 12 words as numbered pills in a 4-column grid.
- Words are **blurred by default** — prevents shoulder-surfing.
- **Reveal** button toggles blur off/on.
- **Copy phrase** button is disabled until the phrase is revealed (deliberate
  friction — copy without reveal isn't useful and could leak the phrase).
- A "Stored on this device only" badge reinforces that the phrase never leaves
  the browser.
- A yellow warning banner explains the phrase must not be shared and there is
  no server-side recovery.

### Wiring into Settings

`settings-page-client.tsx` was updated:

```tsx
// New nav item added between Security and Dropbox:
{ id: "vault", label: "Vault Key", icon: KeyRound },

// New section rendered in the content area:
{activeSection === "vault" && <VaultKeySection />}
```

`settings/types.ts` was updated:

```ts
export type Section = "profile" | "security" | "vault" | "dropbox";
```

---

## Dependencies

```bash
pnpm add @scure/bip39 --filter @meerkat/web
```

No other new dependencies. Identity derivation uses the built-in Web Crypto
API (SHA-256). Encryption key derivation uses Web Crypto HKDF. Blob
encryption uses `encryptBlob` from `@meerkat/crypto` (already a dep).

**Import note** — use the `.js` extension or Next.js will throw at build time:

```ts
import { wordlist } from "@scure/bip39/wordlists/english.js"; // ✅
import { wordlist } from "@scure/bip39/wordlists/english"; // ❌ module not found
```

---

## Supabase setup

1. **Disable email confirmations** — Auth → Settings → turn off
   "Enable email confirmations". The derived email is fake so confirmation
   links would go nowhere.
2. **No other changes needed** — the flow uses standard
   `signUp` / `signInWithPassword`, so existing RLS policies, triggers, and
   the `profiles` table all work as before.

---

## Security properties

| Property               | Detail                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Server blindness       | Supabase only stores `<hex>@meerkat.vault` / `<hex>` — no link to the real user           |
| Content encryption     | Voice blobs and attachments are AES-GCM-256 encrypted before upload                       |
| Key non-extractability | HKDF-derived `CryptoKey` is `extractable: false` — raw bytes cannot be exfiltrated via JS |
| No recovery path       | If the mnemonic is lost, there is no account recovery — by design                         |
| Sign-out completeness  | `clearVault()` removes mnemonic, profile, and both cookies atomically                     |
| Cross-device recovery  | Same mnemonic → same HKDF key → can decrypt existing blobs on a new device                |

---

## Remaining work

- Decrypt `.enc` voice blobs on playback (`use-voice-url.ts` needs to call
  `decryptBlob` after fetching the signed URL).
- Encrypt note/text content (currently stored in Yjs/IndexedDB without an
  additional encryption layer on top of the vault key).
