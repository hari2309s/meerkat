# Offline-First Architecture & Auth V2 — Implementation Complete

**Date**: 2026-03-08  
**Status**: Complete ✅

---

## Overview

This document covers two interrelated changes that together make Meerkat work **100% offline**:

1. **Auth V2 — Pure On-Device** — The `/v2/signup` and `/v2/login` flows no longer call Supabase at all. The mnemonic phrase is the user's identity; everything is stored in `localStorage` and mirrored into cookies for the server layer.

2. **Full Offline Support** — Server components, middleware, the PWA service worker, and sign-out flows have all been updated so that a V2 vault user can load, navigate, and use the app with zero network connectivity after the first visit.

---

## What Changed and Why

### The Problem

The previous V2 auth flow still called `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()` under the hood — it just derived a fake email/password from the mnemonic. This meant:

- Signup and login required internet
- Server components called `supabase.auth.getUser()` which also requires internet
- Middleware called Supabase on every request
- Coming back online triggered a hard page reload, destroying in-memory CRDT state

### The Solution

A **two-cookie strategy** bridges the gap between `localStorage` (client-only) and server components (can't read `localStorage`):

| Cookie               | Value         | Set by                                    | Read by                             |
| -------------------- | ------------- | ----------------------------------------- | ----------------------------------- |
| `vault_session`      | `"1"`         | `setVaultSessionCookie()` on login/signup | `middleware.ts`, `getCurrentUser()` |
| `vault_profile_name` | `"Meera Kat"` | `setProfileNameCookie()` on login/signup  | `getCurrentUser()`                  |

The mnemonic itself **never leaves `localStorage`** — it is never put in a cookie or sent anywhere.

---

## File Map

```
apps/web/
├── lib/
│   ├── vault-credentials.ts        ← rewritten (pure on-device)
│   └── get-current-user.ts         ← NEW — unified server-side user resolver
├── middleware.ts                   ← updated — vault_session cookie support
├── next.config.js                  ← updated — PWA offline fixes
├── app/
│   ├── page.tsx                    ← updated — uses getCurrentUser()
│   ├── offline/
│   │   └── page.tsx                ← NEW — offline fallback page
│   └── (auth)/
│       ├── v2/
│       │   ├── signup/page.tsx     ← updated — no Supabase, sets cookies
│       │   └── login/page.tsx      ← updated — no Supabase, sets cookies
│       └── signout/route.ts        ← updated — clears all cookies
└── components/
    ├── top-nav.tsx                 ← patch: clearVault() on sign-out
    └── settings/
        └── security-section.tsx   ← patch: clearVault() on sign-out all
```

---

## Auth V2 — Pure On-Device Flow

### Identity model

The mnemonic phrase **is** the user's identity. There is no server account.

```
Signup                              Login
──────                              ─────
generateMnemonic()                  user enters mnemonic
     │                                    │
     ▼                                    ▼
show & acknowledge phrase          validateMnemonic() — BIP39 checksum
     │                                    │
     ▼                                    ▼
enter display name                 saveMnemonic() → localStorage
     │                                    │
     ▼                                    ▼
saveMnemonic()    → localStorage   setVaultSessionCookie() → cookie
saveProfile()     → localStorage   setProfileNameCookie()  → cookie
setVaultSessionCookie() → cookie         │
setProfileNameCookie()  → cookie         ▼
     │                             router.push(nextUrl)
     ▼
router.push(nextUrl)
```

### Storage layout

| Key                  | Storage          | Contents                      |
| -------------------- | ---------------- | ----------------------------- |
| `vault_mnemonic`     | `localStorage`   | 12-word BIP39 phrase          |
| `vault_profile`      | `localStorage`   | `{ name, createdAt }` JSON    |
| `vault_session`      | Cookie (30 days) | `"1"` — session presence flag |
| `vault_profile_name` | Cookie (30 days) | URL-encoded display name      |

### Why cookies alongside localStorage?

Next.js Server Components and `middleware.ts` run on the server and cannot access `localStorage`. Cookies are sent with every HTTP request so the server can:

- **Middleware** — decide whether to redirect to `/login` or allow through
- **Server components** (`app/page.tsx`, etc.) — show the correct display name without a client-side waterfall

The cookies hold no secret. The mnemonic (the only secret) stays in `localStorage` only.

---

## `lib/vault-credentials.ts`

Full replacement. The `deriveCredentials()` function has been removed (it existed only to create a fake Supabase email/password — no longer needed).

**Exports:**

```ts
// Mnemonic storage
saveMnemonic(mnemonic: string): void
loadMnemonic(): string | null
clearMnemonic(): void

// Profile storage
saveProfile(profile: VaultProfile): void   // { name, createdAt }
loadProfile(): VaultProfile | null
clearProfile(): void

// Session cookie — readable by middleware
setVaultSessionCookie(): void
clearVaultSessionCookie(): void

// Full sign-out
clearVault(): void   // clears mnemonic + profile + both cookies

// Constant
VAULT_SESSION_COOKIE = "vault_session"
```

---

## `lib/get-current-user.ts` — NEW

A single server-side function that resolves the current user from either auth system. Replace all direct `supabase.auth.getUser()` calls in Server Components with this.

```ts
import { getCurrentUser } from "@/lib/get-current-user";

const user = await getCurrentUser();
// user is null if not logged in
// user.authType === "supabase" | "vault"
```

**Resolution order:**

1. Check `vault_session` cookie → if present, return a synthetic vault user using the `vault_profile_name` cookie for the display name.
2. Otherwise call `supabase.auth.getUser()` → return a Supabase user.
3. If both fail → return `null` (unauthenticated).

**Constant exported for reuse:**

```ts
export const VAULT_PROFILE_NAME_COOKIE = "vault_profile_name";
```

---

## `middleware.ts`

Updated to accept either a valid Supabase session **or** a `vault_session` cookie as proof of authentication.

```ts
const isLoggedIn = !!supabaseUser || hasVaultSession;
```

**Key behaviour changes:**

- `/v2/login` and `/v2/signup` are always public — they no longer redirect logged-in users away. A user can create a new vault even if already signed in.
- All other protected routes continue to require `isLoggedIn`.

---

## `next.config.js` — PWA Changes

Three important changes to the PWA/Workbox configuration:

### 1. `reloadOnOnline: false`

Previously `true`. The old setting caused a hard page reload the moment the device came back online. This destroyed all in-memory Yjs/CRDT state and was jarring UX. With `false`, the app silently resumes — Yjs will sync when P2P peers reconnect.

### 2. `disable: false`

The service worker was disabled in development (`process.env.NODE_ENV === "development"`). This made it impossible to test offline behaviour locally. It is now always enabled. To skip SW registration in dev, pass `?nosw=1` to the URL or clear the SW in DevTools → Application → Service Workers.

### 3. `navigateFallback: "/offline"`

When a navigation request (page load) fails offline and the page isn't in the Workbox precache, the SW now serves `/offline` instead of the browser's default error screen. The offline page shows a friendly message and a back button; if the device comes back online it shows a reload button.

API routes (`/api/*`) and auth callbacks (`/auth/*`) are excluded from the fallback — they fail transparently so the app can handle errors in-band.

---

## `app/offline/page.tsx` — NEW

A client component served as the offline fallback. Listens for the `online` event and switches from "you're offline" messaging to a "reload" CTA when connectivity returns.

Place this file at: `apps/web/app/offline/page.tsx`

---

## Sign-out

Sign-out must clear **both** auth systems to avoid ghost sessions.

### `clearVault()` — client-side (vault-credentials.ts)

Call this from any client component before navigating away:

```ts
import { clearVault } from "@/lib/vault-credentials";

// Clears: localStorage vault_mnemonic, vault_profile
//         cookies:    vault_session, vault_profile_name
clearVault();
```

### `app/(auth)/signout/route.ts` — server-side

The POST handler clears both the Supabase session cookie (via `supabase.auth.signOut()`) and the vault cookies (via `response.cookies.set(..., { maxAge: 0 })`).

### Components to patch

**`components/top-nav.tsx`** — `handleSignOut`:

```ts
import { clearVault } from "@/lib/vault-credentials";

const handleSignOut = async () => {
  startNavigationProgress();
  clearVault(); // vault users
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" }); // Supabase users (no-op if no session)
  router.push("/login");
  router.refresh();
};
```

**`components/settings/security-section.tsx`** — `handleSignOutAll`:

```ts
import { clearVault } from "@/lib/vault-credentials";

const handleSignOutAll = async () => {
  setIsSigningOut(true);
  try {
    clearVault();
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/login");
  } catch (err) { ... }
};
```

---

## Server Component Migration Guide

Any Server Component that previously did this:

```ts
// ❌ Old — requires network, breaks for vault users
const supabase = createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) redirect("/login");
```

Should now do this:

```ts
// ✅ New — works offline for vault users
import { getCurrentUser } from "@/lib/get-current-user";
const user = await getCurrentUser();
if (!user) redirect("/login");
```

The returned `CurrentUser` object has:

```ts
interface CurrentUser {
  id: string; // Supabase UUID for v1, "vault" for v2
  name: string;
  preferredName: string | null;
  email: string; // empty string for vault users
  authType: "supabase" | "vault";
}
```

For code that branches on auth type (e.g. `DensSection` which queries Supabase for v1 users):

```ts
<DensSection userId={user.authType === "supabase" ? user.id : "local"} />
```

---

## Offline Behaviour Matrix

| Action                   | V1 (Supabase) offline           | V2 (Vault) offline                     |
| ------------------------ | ------------------------------- | -------------------------------------- |
| Visit cached page        | ✅ SW serves cached shell       | ✅ SW serves cached shell              |
| Visit uncached page      | ✅ `/offline` fallback          | ✅ `/offline` fallback                 |
| Open existing den        | ✅ IndexedDB (local-first)      | ✅ IndexedDB (local-first)             |
| Create/edit note         | ✅ Yjs CRDT, syncs on reconnect | ✅ Yjs CRDT, syncs on reconnect        |
| Sign in                  | ❌ Needs Supabase network       | ✅ Mnemonic validated client-side only |
| Sign up                  | ❌ Needs Supabase network       | ✅ No network call                     |
| P2P sync                 | ✅ Resumes when back online     | ✅ Resumes when back online            |
| Hard reload on reconnect | ✅ No (reloadOnOnline: false)   | ✅ No (reloadOnOnline: false)          |

---

## Testing Offline Mode

### 1. Chrome DevTools

1. Open the app and sign in with a V2 vault key
2. Navigate to a den, create a note
3. DevTools → Network tab → set throttling to **Offline**
4. Reload the page — it should load from the SW cache
5. Create another note — it should save to IndexedDB
6. Set throttling back to **No throttling**
7. The note should still be there (no reload occurred)

### 2. Service Worker in DevTools

```
DevTools → Application → Service Workers
```

Verify the SW is registered. If testing on `localhost` in development, the SW is now active (previously disabled). Hard-refresh may be required after the first build.

### 3. IndexedDB inspection

```
DevTools → Application → IndexedDB → meerkat-den-{denId}
```

Notes and voice memos written offline should appear here immediately.

---

## Dependencies

No new dependencies were added. The changes use:

- **Web Crypto API** — already used by `vault-credentials.ts` for SHA-256 derivation (now removed, but Crypto is used elsewhere)
- **`@scure/bip39`** — already a dependency; `validateMnemonic` is unchanged
- **`@ducanh2912/next-pwa` / Workbox** — already a dependency; only configuration changed
- **`localStorage` / `document.cookie`** — browser built-ins

---

## Security Notes

- The `vault_session` cookie is `SameSite=Strict` and does **not** carry any secret — it is a presence flag only. An attacker who steals the cookie cannot derive the mnemonic.
- The `vault_profile_name` cookie carries only the display name — no identity or secret.
- The mnemonic is stored in `localStorage` which is scoped to the origin. It is never sent to any server.
- V2 users have no server-side account. There is no "forgot password" flow by design — the mnemonic is irrecoverable.
- `clearVault()` wipes all local state. Users should be warned before calling this (e.g. confirm modal on sign-out if they haven't backed up their key).

---

## What's Next

- **Settings → "Show my Key"** — read `vault_mnemonic` from `localStorage`, display with blur + copy button, so users can recover their phrase on the same device
- **Key export** — export the mnemonic as a QR code or encrypted backup file
- **Multi-device login** — vault users entering their key on a second device should trigger a CRDT merge of their IndexedDB state via a one-time P2P handshake
- **CSP headers** — add `Content-Security-Policy` to `next.config.js` now that there are no inline Supabase auth redirects to worry about for V2 users
