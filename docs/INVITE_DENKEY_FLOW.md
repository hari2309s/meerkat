# Invite + DenKey Flow

> **Added:** 2026-02-28
> **Scope:** `apps/web`, `@meerkat/keys`, `@meerkat/crypto`

---

## Overview

When a host invites someone to their den, the invitee receives two things in a single link:

1. **Platform membership** — a `den_invites` row that, on acceptance, creates a `den_members` row (so the den appears in their dashboard).
2. **DenKey (capability token)** — a `house-sit` DenKey sealed inside a flower pot on the server, redeemed automatically when the invitee accepts the invite.

Without the DenKey, the invitee can see the den in their dashboard but cannot access any P2P-synced shared content. With it, the `useJoinDen` hook auto-connects them to the host's P2P session the next time they open the den.

Both layers are complementary: `den_members` controls dashboard visibility (server-side), DenKey controls content access (client-side, zero-knowledge).

---

## Architecture

### Zero-Knowledge Key Delivery

The DenKey is never sent to the server in plaintext. Delivery uses an **ephemeral X25519 keypair** per invite:

```
Host (InviteModal)
  1. generateKeyPair()         → { publicKey, secretKey }
  2. generateKey(house-sit)    → DenKey (30 days)
  3. depositKey(denKey, publicKey)
       → encryptBundle(denKey, publicKey)   // sealed with visitor's public key
       → POST /api/flower-pots              // stores opaque ciphertext
       → returns flowerPotToken
  4. Invite URL: /invite/TOKEN#sk=BASE64(secretKey)
     ↑ hash fragment NEVER sent to server (URL spec)

Invitee (InvitePageClient)
  5. Accept invite → den_members insert
  6. Read #sk= from window.location.hash
  7. redeem(flowerPotToken, fromBase64(sk))
       → GET /api/flower-pots?token=...     // fetches ciphertext
       → decryptBundle(ciphertext, secretKey) // NaCl box open
       → store DenKey in localStorage (meerkat:den-keys)

Den page (den-page-client-enhanced.tsx)
  8. useStoredKeys() finds valid DenKey for this den
  9. useJoinDen(p2pOptions).join(denKey)   // WebRTC connect to host
```

The server stores only:

- `flower_pots.encrypted_bundle` — an opaque ciphertext (server is zero-knowledge)
- `den_invites.flower_pot_token` — foreign reference to the flower pot

---

## Supabase Schema Changes

Run in the Supabase SQL editor before deploying this feature.

### flower_pots table

```sql
CREATE TABLE flower_pots (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token            TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  den_id           TEXT NOT NULL,
  encrypted_bundle TEXT NOT NULL,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_flower_pots_token      ON flower_pots(token);
CREATE INDEX idx_flower_pots_expires_at ON flower_pots(expires_at);

ALTER TABLE flower_pots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read non-expired flower pots"
  ON flower_pots FOR SELECT
  USING (expires_at IS NULL OR expires_at > NOW());

CREATE POLICY "Authenticated users can create flower pots"
  ON flower_pots FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can delete flower pots"
  ON flower_pots FOR DELETE USING (auth.uid() = created_by);
```

### den_invites column

```sql
ALTER TABLE den_invites ADD COLUMN IF NOT EXISTS flower_pot_token TEXT;
```

---

## API

### `POST /api/flower-pots`

Deposits a sealed DenKey bundle.

**Auth**: Required (session cookie).

**Body**:

```json
{
  "denId": "uuid",
  "encryptedBundle": "base64-ciphertext",
  "expiresAt": "2026-03-29T00:00:00.000Z"
}
```

**Response** `200`:

```json
{ "token": "unique-token-string" }
```

### `GET /api/flower-pots?token=X`

Fetches a sealed bundle for redemption. Public — anyone with the token can fetch.

**Response** `200`:

```json
{ "encryptedBundle": "base64-ciphertext" }
```

**Response** `404`: Token not found or expired.

### `DELETE /api/flower-pots?token=X`

Revokes a flower pot. RLS enforces creator-only deletion.

**Auth**: Required.

**Response** `204`: No content.

---

## Files Changed

| Action | File                                               | Purpose                                      |
| ------ | -------------------------------------------------- | -------------------------------------------- |
| CREATE | `apps/web/app/api/flower-pots/route.ts`            | REST API for flower pot CRUD                 |
| MODIFY | `apps/web/components/den/invite-modal.tsx`         | Generate + deposit DenKey on invite creation |
| MODIFY | `apps/web/app/invite/[token]/page.tsx`             | Pass `flowerPotToken` to client component    |
| MODIFY | `apps/web/components/invite-page-client.tsx`       | Redeem DenKey on invite acceptance           |
| MODIFY | `apps/web/app/dens/[id]/layout.tsx`                | Remove DenProvider (moved to page)           |
| MODIFY | `apps/web/app/dens/[id]/page.tsx`                  | Wrap with `DenProvider readOnly={!isOwner}`  |
| MODIFY | `apps/web/components/den-page-client-enhanced.tsx` | Visitor P2P auto-join via `useJoinDen`       |
| MODIFY | `apps/web/components/den/visitor-panel.tsx`        | Fix hosting UI (was stuck on "Not hosting")  |

---

## InviteModal Changes

[apps/web/components/den/invite-modal.tsx](../apps/web/components/den/invite-modal.tsx)

The `generate()` effect (runs on mount) now:

1. Creates the `den_invites` row (existing).
2. Generates an ephemeral `X25519` keypair via `generateKeyPair()`.
3. Generates placeholder namespace keys via `generateDenNamespaceKeys()`.
   - Content isn't namespace-encrypted in Phase 4; these satisfy `validateKey()` structural checks only. Real namespace scoping is Phase 5+.
4. Generates a `house-sit` DenKey (30 days) via `generateKey()`.
5. Deposits the sealed bundle via `depositKey()` → `POST /api/flower-pots`.
6. Updates `den_invites.flower_pot_token` with the returned token.
7. Stores `toBase64(secretKey)` in state → appended to the invite URL as `#sk=`.

The **invite link** format:

```
https://app.meerkat.io/invite/TOKEN#sk=BASE64_SECRET_KEY
```

The display box shows only `/invite/TOKEN` (without the secret). The copy button copies the full URL including the hash fragment.

The **email send** path creates a separate `den_invites` row with its own dedicated flower pot and keypair per recipient.

---

## Invite Acceptance Changes

[apps/web/components/invite-page-client.tsx](../apps/web/components/invite-page-client.tsx)

In `handleJoin`, after the `den_members` insert:

```ts
if (flowerPotToken) {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const sk = new URLSearchParams(hash.slice(1)).get("sk");
  if (sk) {
    await redeem({
      token: flowerPotToken,
      visitorSecretKey: fromBase64(sk),
      fetchFromServer: async (t) => {
        const res = await fetch(
          `/api/flower-pots?token=${encodeURIComponent(t)}`,
        );
        return res.ok ? res.json() : null;
      },
    }).catch(() => {
      /* non-fatal */
    });
  }
}
```

`useRedeemKey().redeem()` decrypts the bundle using the visitor's secret key (NaCl box open) and persists the resulting `DenKey` to `localStorage` under `meerkat:den-keys`. This happens entirely client-side — the server never sees the plaintext key.

DenKey redemption is **non-fatal**: if the hash fragment is missing or redemption fails, the user still becomes a member; they just won't auto-connect to P2P until they receive a new key.

---

## DenProvider: readOnly for Non-Owners

[apps/web/app/dens/[id]/page.tsx](../apps/web/app/dens/[id]/page.tsx)

Previously, `DenProvider` lived in `layout.tsx` and always started hosting regardless of ownership. This caused non-owners to broadcast `"host-online"` on the signaling channel — a bug that could confuse other visitors trying to connect.

`DenProvider` was moved to `page.tsx` where `isOwner` is known from server data:

```tsx
const isOwner = den.user_id === user.id;
return (
  <DenProvider denId={den.id} readOnly={!isOwner}>
    <DenPageClientEnhanced ... />
  </DenProvider>
);
```

When `readOnly={true}`, `DenSyncMachine.start()` skips the `hostDen()` call — non-owners never auto-host.

---

## Visitor P2P Auto-Join

[apps/web/components/den-page-client-enhanced.tsx](../apps/web/components/den-page-client-enhanced.tsx)

Non-owners with a valid DenKey in localStorage now auto-connect to the host's WebRTC session when both `localFirstStorage` and `p2pSync` feature flags are enabled.

```
useStoredKeys() → validKeys → find key for activeDen.id → activeDenKey
useJoinDen(p2pOptions) → { join, status: visitorStatus, disconnect }

Effect (auto-join):
  if (!isOwner && useLocalFirst && p2pEnabled && activeDenKey && visitorStatus === "offline")
    joinDen(activeDenKey)

Effect (cleanup):
  if (!isOwner) leaveP2P()   // on unmount
```

`p2pOptions` is a stable `useMemo` value wrapping a Supabase Realtime channel factory — same pattern used in `P2PProvider`.

`DenHeaderEnhanced` receives the correct sync status for each role:

- Owner: `syncStatus` (from `useDenContext()`)
- Visitor: `visitorStatus` (from `useJoinDen()`)

---

## Hosting UI Fix

[apps/web/components/den/visitor-panel.tsx](../apps/web/components/den/visitor-panel.tsx)

**Bug**: After clicking "Start hosting", the console confirmed hosting started but the UI still showed "Not hosting".

**Root cause**: `isHosting` was `syncStatus === "hosting" || syncStatus === "connecting"`. When hosting starts, `HostManager` transitions to `"synced"` (signaling channel active, no visitors yet), which was incorrectly treated as "not hosting".

**Fix**:

```ts
// Before
const isHosting = syncStatus === "hosting" || syncStatus === "connecting";
// After
const isHosting = syncStatus !== "offline";
```

Status text now shows `"Waiting for visitors…"` for both `"connecting"` and `"synced"` states, and the `"X visitors connected"` count for `"hosting"`.

---

## Verification Checklist

1. **Host flow**: Open InviteModal → copy link → confirm URL contains `#sk=` → open browser network tab and confirm no request to `/api/flower-pots` includes the secret key.
2. **New user flow**: Open invite link in incognito → sign up → accept → open DevTools → confirm `meerkat:den-keys` in `localStorage` has an entry for the den.
3. **P2P join**: Enable `localFirstStorage` + `p2pSync` flags → non-owner opens den with valid DenKey → `useJoinDen` connects → host's visitor panel shows 1 visitor → `DenHeaderEnhanced` shows synced status for visitor.
4. **Key expiry**: Manually set `expires_at` to past in Supabase → `useValidateKey` returns false → `validKeys` is empty → no auto-join.
5. **Hosting UI**: Click "Start hosting" → button should immediately become "Stop hosting" with "Waiting for visitors…" status.
6. **Non-owner no-host**: Open den as non-owner → confirm no `"host-online"` broadcast in Supabase Realtime inspector.

---

## Known Limitations (Phase 4)

- **Namespace keys are placeholders**: `generateDenNamespaceKeys()` creates structurally valid keys but the host's real `sharedNotes`/`voiceThread` namespace keys (stored in `private.ydoc`) are not transferred to the visitor. Full namespace-level content encryption is planned for Phase 5.
- **Single flower pot per invite**: Each invite link carries exactly one DenKey. If the visitor loses their localStorage, they need a new invite link.
- **No re-request UI**: If DenKey redemption fails silently (non-fatal), there is no UI to trigger a retry. A future "Request new key" button is planned.
- **STUN/TURN**: WebRTC P2P connections work on the same network or without symmetric NAT. Production TURN server config is pending.
