# Meerkat — Development Plan

**Last Updated**: 2026-03-01

---

## Project Overview

Meerkat is a local-first, privacy-preserving collaborative workspace. All content lives on your device, encrypted at rest. When you share a den, visitors connect directly over WebRTC — content never passes through the server.

---

## Repository Structure

```
apps/
└── web/                        # Next.js 14 (App Router)
    ├── app/
    │   ├── dens/[id]/
    │   │   ├── layout.tsx      # Thin layout (no provider — moved to page.tsx)
    │   │   └── page.tsx        # DenProvider with readOnly={!isOwner}
    │   └── invite/[token]/     # DenKey redemption flow
    ├── components/
    │   ├── den-page-client-enhanced.tsx  # Hybrid local-first / legacy page
    │   └── den/
    │       ├── den-header-enhanced.tsx   # Sync status badge for owner + visitor
    │       └── visitor-panel.tsx         # Host-only: status text + Start/Stop hosting
    ├── providers/
    │   └── p2p-provider.tsx    # initP2P() during render (must run before effects)
    └── lib/
        └── supabase/client.ts  # Singleton browser Supabase client (cached)

packages/
    ├── analyzer/               # On-device emotion & transcription ✅
    ├── config/                 # Environment validation ✅
    ├── crypto/                 # AES-GCM, PBKDF2, NaCl box ✅
    ├── crdt/                   # Den orchestration + DenSyncMachine ✅
    ├── keys/                   # DenKey capability tokens (flower pots) ✅
    ├── local-store/            # Yjs docs + IndexedDB persistence ✅
    ├── p2p/                    # WebRTC P2P sync ✅ COMPLETE
    ├── types/                  # Shared domain types ✅
    ├── ui/                     # Shared React component library ✅
    ├── utils/                  # General utilities ✅
    └── voice/                  # Voice recording lifecycle ✅
```

---

## Development Phases

### ✅ Phase 1: Foundation (COMPLETE)

**Goal**: Core local-first storage with encryption

- [x] Project scaffolding (pnpm workspaces + TurboRepo)
- [x] `@meerkat/crypto` — device key derivation, blob encryption, bundle sealing
- [x] `@meerkat/types` — shared domain types (NoteData, VoiceMemoData, etc.)
- [x] `@meerkat/local-store` — Yjs documents (private.ydoc + shared.ydoc), IndexedDB persistence
- [x] `@meerkat/config` — environment validation
- [x] Basic Next.js app with Supabase auth
- [x] Private notes CRUD (fully offline-capable)

**Exit Criteria Met ✅**: Create, read, update, delete notes with encrypted at-rest storage. Works offline.

---

### ✅ Phase 2: Voice + On-Device Analysis (COMPLETE)

**Goal**: Voice recording with browser-side transcription and mood detection

- [x] `@meerkat/analyzer` — dual-signal pipeline (audio features + text emotion)
  - [x] Whisper tiny integration (WASM, ~75 MB)
  - [x] Emotion text classifier (ONNX, ~40 MB)
  - [x] Signal fusion (acoustic + semantic)
  - [x] React hooks: `useModelStatus`, `usePreloadModels`, `useAnalyzeVoice`
- [x] `@meerkat/voice` — recording state machine, encryption, storage
  - [x] `useVoiceRecorder` hook (recording → preview → save pipeline)
  - [x] `useVoicePlayer` hook (playback with decryption)
  - [x] Encrypted blob upload to Supabase Storage
- [x] Voice UI components in web app

**Exit Criteria Met ✅**: Record a voice memo, analyze mood on-device, encrypt, upload, and store. View mood data and transcript without sending audio to server.

---

### ✅ Phase 3: Capability Tokens (Flower Pots) (COMPLETE)

**Goal**: Secure, scoped access control for visitors

- [x] `@meerkat/keys` — DenKey generation, sealing, redemption
  - [x] Key type presets: Come Over, Letterbox, House-sit, Peek
  - [x] Namespace scoping (sharedNotes, voiceThread, dropbox, presence) + expiry
  - [x] React hooks: `useGenerateKey`, `useRedeemKey`, `useStoredKeys`
- [x] Server API — `POST/GET/DELETE /api/flower-pots`
- [x] Web UI
  - [x] InviteModal generates DenKey + flower pot on link creation
  - [x] Invite URL embeds ephemeral secret key in hash fragment (`#sk=BASE64`) — never sent to server
  - [x] Invite acceptance page redeems DenKey automatically on join
  - [x] DenKey stored in `localStorage` (`meerkat:den-keys`) for P2P use
  - [x] Key type selector + expiry duration picker in InviteModal
- [x] Supabase schema: `flower_pots` table + `den_invites.flower_pot_token`

**Exit Criteria Met ✅**: Host invites someone → invitee accepts link → DenKey in localStorage → ready for P2P auto-join. Server stores only opaque ciphertext.

> See [docs/INVITE_DENKEY_FLOW.md](./INVITE_DENKEY_FLOW.md) for full architecture.

---

### ✅ Phase 4: Peer-to-Peer Sync (COMPLETE)

**Goal**: WebRTC direct connections for real-time Yjs sync between host and visitors

**Verified end-to-end: 2026-03-01**

#### Package Implementation ✅

- [x] `@meerkat/p2p` — full core architecture, tested
  - [x] `P2PManager` — singleton, implements `P2PAdapter` for `@meerkat/crdt`
  - [x] `HostManager` — one per hosted den; Supabase Realtime signaling, WebRTC handshake
  - [x] `VisitorConnection` — one per visited den; joins, Yjs sync over RTCDataChannel
  - [x] `SignalingChannel` — Supabase Realtime broadcast wrapper + `buildIceServers()`
  - [x] `wireScopedYjsSync` — scoped Yjs sync enforcing DenKey namespace/write access
  - [x] `OfflineDropManager` — Letterbox async upload/collect logic
  - [x] Unit + integration tests (26 passing)

#### `@meerkat/crdt` Integration ✅

- [x] `resolveP2PAdapter()` — dynamic import of `@meerkat/p2p`, graceful fallback to `offlineAdapter`
- [x] `DenSyncMachine` — `offline → connecting → synced → hosting` with validated transitions
- [x] P2P status propagated to `DenState.syncStatus` in both `useStandaloneDen` and `DenProvider`
- [x] `@meerkat/p2p` declared as optional peer dependency

#### Web App Integration ✅

- [x] `P2PProvider` in layout — calls `initP2P()` synchronously during render
- [x] `DenProvider` moved from `layout.tsx` → `page.tsx` with `readOnly={!isOwner}`
  - Non-owners never auto-broadcast `"host-online"` or auto-host
- [x] `den-page-client-enhanced.tsx` — visitor auto-join via `useJoinDen`
  - Uses a fresh `createBrowserClient()` for `p2pOptions` (not the cached singleton — see bug fix below)
  - Auto-connects once when `activeDenKey` is available + flags enabled
  - P2P errors surfaced to visitor via toast
- [x] `DenHeaderEnhanced` — owner sees `syncStatus` from `useDenContext`; visitor sees `visitorStatus` from `useJoinDen`
- [x] `VisitorPanel` — owner-only (`canDisconnect` guard); shows "Waiting for visitors…" / "N visitors connected" + Stop/Start hosting button
- [x] `VisitorPresenceList` — uses CSS custom properties (`--color-surface-raised`, `--color-accent`) to match den page design

#### TURN / NAT Traversal ✅

- [x] `buildIceServers()` in `signaling.ts` reads TURN credentials from env vars:
  1. `NEXT_PUBLIC_METERED_TURN_HOST/USERNAME/CREDENTIAL` — Metered.ca (**configured in Vercel**)
  2. `NEXT_PUBLIC_CF_TURN_USERNAME/CREDENTIAL` — Cloudflare TURN (optional alternative)
  3. Hardcoded public Metered free-tier fallback (unreliable, dev-only)
- [x] Metered.ca credentials active — cross-network (symmetric NAT) connections verified working

#### Critical Bugs Fixed ✅

All of these were diagnosed and fixed on 2026-03-01:

| Bug                                    | Root cause                                                                                                    | Fix                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Supabase listener drop                 | `.on("broadcast", ...)` registered _after_ `.subscribe()` — Supabase silently drops messages                  | Register all listeners before `signaling.connect()`                             |
| DataChannel never opens                | Host called `createDataChannel()` — but offerer (visitor) must own the channel; host must use `ondatachannel` | Visitor creates channel before `createOffer()`; host uses `peer.ondatachannel`  |
| ICE candidates never arrive at visitor | Host and visitor shared same Supabase WebSocket (singleton cache); Supabase suppresses self-delivery          | Visitor `p2pOptions` uses `createBrowserClient()` directly — separate WebSocket |
| ICE connectivity fails (NAT)           | STUN alone can't traverse symmetric NAT                                                                       | TURN relay via Metered.ca credentials in Vercel env vars                        |
| Visitor sees VisitorPanel              | `VisitorPanel` had no owner guard                                                                             | Added `if (!showNewUI \|\| !canDisconnect) return null`                         |
| Visitor card visual clash              | `VisitorCard` used `bg-gray-50 border border-gray-200` Tailwind classes                                       | Replaced with CSS custom properties matching den page theme                     |

#### Offline Letterbox Flow 🔄 (Partially Complete — carry-over to Phase 5)

- [x] `OfflineDropManager` class implemented in `@meerkat/p2p`
- [x] Dropbox UI — "Dropbox" tab in Settings shows pending items
- [ ] **TODO**: Visitor upload path — trigger encrypted drop upload when host is offline
- [ ] **TODO**: Host collect path — auto-collect pending drops on den open / reconnect

**Phase 4 Exit Criteria**:

1. ✅ Host opens den → `syncStatus: "hosting"` (UI reflects this immediately)
2. ✅ Visitor accepts invite → DenKey stored in localStorage automatically
3. ✅ Visitor opens den → auto-connects via WebRTC → `syncStatus: "synced"`
4. ✅ Host creates a note → visitor sees it within 1 second
5. ✅ Host goes offline → visitor `syncStatus: "offline"`, content cached locally
6. ❌ Letterbox: visitor uploads drop when offline → host imports on reconnect (not wired end-to-end)

**Known Limitations (carry-over to Phase 5)**:

- Namespace keys are structural placeholders — real namespace-level content encryption is Phase 5
- Single flower pot per invite — lost localStorage = need new invite
- No DenKey re-request UI

> See [docs/P2P_INTEGRATION_COMPLETE.md](./P2P_INTEGRATION_COMPLETE.md) for full integration detail.
> See [docs/INVITE_DENKEY_FLOW.md](./INVITE_DENKEY_FLOW.md) for the invite → DenKey → P2P join flow.

---

### 📋 Phase 5: Polish & Hardening (PLANNED)

**Goal**: Production-ready UX, full encryption, and robustness

#### Carry-overs from Phase 4

- [ ] Letterbox offline drop flow — visitor upload + host auto-collect on reconnect
- [ ] Full namespace key transfer — real scoped encryption for visitor content access
- [ ] DenKey re-request UI — retry button when redemption fails silently

#### New Features

- [ ] Block-based editor (Notion-style)
  - [ ] Text, heading, list, voice blocks
  - [ ] Drag-and-drop reordering
  - [ ] `/` command menu
- [ ] Advanced search (full-text, mood, date, tags)
- [ ] Settings & preferences (theme, voice format, default note privacy, auto-transcribe)
- [ ] Backup & restore — export/import den as encrypted JSON, verify via Yjs state vectors
- [ ] Mobile responsiveness + PWA manifest + service worker

#### Security Hardening

- [ ] Content Security Policy (CSP) headers
- [ ] Rate limiting on flower pot creation/redemption
- [ ] Key rotation (device key + namespace key)
- [ ] Audit logging (client-side, encrypted)

#### Testing

- [ ] E2E tests (Playwright) — auth, note CRUD, voice, key redemption, P2P sync
- [ ] Unit test coverage ≥ 80%
- [ ] Load testing (many notes, large Yjs docs)
- [ ] Security audit (external review of crypto implementation)

---

## Package Dependency Graph

```
@meerkat/web
  ├─► @meerkat/crdt
  │     ├─► @meerkat/local-store
  │     │     ├─► @meerkat/types
  │     │     └─► @meerkat/crypto
  │     ├─► @meerkat/p2p (optional peer dep)
  │     │     ├─► @meerkat/keys
  │     │     │     ├─► @meerkat/crypto
  │     │     │     └─► @meerkat/types
  │     │     └─► @meerkat/local-store
  │     └─► @meerkat/types
  │
  ├─► @meerkat/voice
  │     ├─► @meerkat/analyzer
  │     │     └─► @meerkat/types
  │     ├─► @meerkat/crypto
  │     ├─► @meerkat/local-store
  │     └─► @meerkat/types
  │
  ├─► @meerkat/keys
  ├─► @meerkat/ui
  └─► @meerkat/utils
```

---

## Key Design Decisions

### Separate Supabase Client for Visitor Signaling

`createClient()` from `apps/web/lib/supabase/client.ts` returns a cached singleton via `@supabase/ssr`. The `P2PProvider` (host) uses this singleton for signaling. If the visitor's `p2pOptions` also uses `createClient()`, both peers share the same WebSocket — and Supabase does not deliver broadcast messages back to the sending socket, so the visitor silently receives zero ICE candidates from the host.

**Fix**: visitor `p2pOptions` in `den-page-client-enhanced.tsx` calls `createBrowserClient()` directly with the Supabase URL and anon key, bypassing the cache and getting a dedicated WebSocket connection.

### Supabase Realtime Listener Registration Order

All `.on("broadcast", ...)` listener registrations must complete **before** calling `.subscribe()`. Supabase processes incoming messages only for listeners that were registered before the subscription was confirmed. Both `HostManager.start()` and `VisitorConnection.connect()` follow this pattern — they wire all handlers, then call `signaling.connect()`.

### WebRTC DataChannel Ownership

The **offerer** (visitor) must call `peer.createDataChannel()` before `peer.createOffer()` — this embeds the data channel negotiation into the SDP offer. The **answerer** (host) must not call `createDataChannel()` independently; it receives the channel via `peer.ondatachannel`. Swapping this causes ICE to succeed but the DataChannel to never open.

### TURN Server via Environment Variables

STUN alone fails when both peers are behind symmetric NAT (typical home routers). `buildIceServers()` in `signaling.ts` reads TURN credentials from `NEXT_PUBLIC_*` env vars at runtime, so credentials can be rotated without a code change. The priority order is Metered.ca credentials → Cloudflare TURN → hardcoded free-tier fallback (dev only).

---

## Environment Variables

### Required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
DIRECT_URL
```

### TURN Server (required for cross-network P2P)

```
NEXT_PUBLIC_METERED_TURN_HOST         # e.g. global.relay.metered.ca
NEXT_PUBLIC_METERED_TURN_USERNAME     # from Metered.ca dashboard
NEXT_PUBLIC_METERED_TURN_CREDENTIAL   # from Metered.ca dashboard
```

### Feature Flags (optional — defaults vary per flag)

```
NEXT_PUBLIC_FF_LOCAL_FIRST    # IndexedDB + CRDT storage
NEXT_PUBLIC_FF_P2P_SYNC       # WebRTC P2P sync
NEXT_PUBLIC_FF_NEW_UI         # Enhanced header + visitor panel
NEXT_PUBLIC_FF_VOICE_ANALYSIS # On-device transcription + mood
NEXT_PUBLIC_FF_ENCRYPTION     # E2E encryption (default: true)
```

---

## Contributing

### Commit Format

```
[scope] -- description

Examples:
[packages/p2p] -- fix DataChannel created on wrong side (visitor must be offerer)
[web] -- use createBrowserClient for visitor signaling to avoid singleton self-delivery
[chore] -- update DEV_PLAN, p2p README for Phase 4 completion
```

### PR Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Type checking passes (`pnpm type-check`)
- [ ] Linting passes (`pnpm lint`)
- [ ] No `console.log` in production paths
- [ ] No secrets in code
- [ ] Relevant docs updated

---

## Resources

- [Yjs Docs](https://docs.yjs.dev/)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Metered.ca TURN](https://www.metered.ca/)
- [Local-First Software](https://www.inkandswitch.com/local-first/)
- [packages/p2p/README.md](../packages/p2p/README.md)
- [packages/crdt/README.md](../packages/crdt/README.md)
- [packages/keys/README.md](../packages/keys/README.md)
- [docs/P2P_INTEGRATION_COMPLETE.md](./P2P_INTEGRATION_COMPLETE.md)
- [docs/INVITE_DENKEY_FLOW.md](./INVITE_DENKEY_FLOW.md)
