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
│   │   ├── signup/page.tsx   ← 3-step onboarding (Welcome → Key → Name)
│   │   └── login/page.tsx    ← Key entry → vault access
├── lib/
│   └── vault-credentials.ts  ← shared derivation + localStorage helpers
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
on the same device without re-entering their phrase. `clearMnemonic()` in
`vault-credentials.ts` should be called on sign-out.

---

## Dependencies

```bash
pnpm add @scure/bip39 --filter @meerkat/web
```

No other new dependencies. Derivation uses the built-in Web Crypto API.

**Import note** — use the `.js` extension or the build will fail:

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

## Middleware

Add the new routes to the public list in `apps/web/middleware.ts`:

```ts
const publicRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
  "/auth/confirm",
  "/v2/login", // ← add
  "/v2/signup", // ← add
];
```

---

## Theming

Both pages reuse `AuthLayout` — meerkats image, noise texture, entry
animations, and all `--color-*` CSS variables are inherited automatically.

The acknowledgement checkbox on the Key step uses a fully custom element
styled with `hsl(var(--meerkat-brown))` for the checked state (border,
fill, and a soft glow ring), replacing the browser-native `accent-*` which
would have shown blue. It responds correctly in both light and dark mode
since `--meerkat-brown` is defined in both theme roots in `globals.css`.

---

## What's next

- Wire up sign-out to call `clearMnemonic()` from `vault-credentials.ts`
- Den and note data encryption — derive a symmetric key from the mnemonic
  using HKDF, encrypt blobs client-side before writing to Supabase Storage
- Settings page — "Show my Key" to let users recover their phrase on the
  current device (read from localStorage, display with blur + copy)
