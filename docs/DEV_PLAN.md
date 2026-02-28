# Meerkat Development Plan

> **Last Updated:** 2026-03-01
> **Status:** Phase 3 Complete | Phase 4 ~85% Complete | Phase 5 Planned

---

## Project Overview

**Meerkat** is a local-first, privacy-focused collaborative workspace featuring voice messaging with on-device mood analysis, real-time collaboration, and peer-to-peer sync. All content is encrypted on-device before storage or transmission.

### Core Principles

- **Local-first**: IndexedDB via Yjs, works fully offline
- **Privacy by default**: End-to-end encryption via `@meerkat/crypto`
- **On-device AI**: Voice transcription and emotion analysis run entirely in the browser
- **P2P architecture**: Direct WebRTC connections when online, offline when host disconnects
- **Zero-knowledge server**: Supabase stores only encrypted blobs and identity—never plaintext content

---

## Technology Stack

### Frontend

- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18+, Tailwind CSS, Framer Motion
- **State**: Zustand, React Query (TanStack)
- **CRDT**: Yjs + y-indexeddb

### Backend & Infrastructure

- **Auth & Storage**: Supabase (auth, encrypted blob storage)
- **API**: tRPC (type-safe API layer)
- **Real-time**: WebRTC (P2P sync), Supabase Realtime (signaling only)
- **Deployment**: Vercel

### AI/ML (Browser-side)

- **Transcription**: Whisper tiny (ONNX, ~75 MB, WASM)
- **Emotion**: `michellejieli/emotion_text_classifier` (ONNX, ~40 MB)
- **Audio Features**: Pure JavaScript (pitch, energy, speaking rate—no model)

### Encryption

- **At-rest**: AES-GCM-256 (Web Crypto API)
- **Key derivation**: PBKDF2-SHA-256 (310k iterations)
- **Capability tokens**: NaCl box (X25519 + XSalsa20-Poly1305)

### Build Tools

- **Monorepo**: pnpm workspaces + TurboRepo
- **TypeScript**: 5.x with strict mode
- **Testing**: Vitest
- **Validation**: Zod

---

## Monorepo Structure

```
meerkat/
├── apps/
│   └── web/                    # Next.js 14 app (App Router)
│       ├── app/                # Routes
│       │   ├── (auth)/         # Login, signup, password reset
│       │   ├── dens/[id]/      # Den view (notes + voice)
│       │   ├── invite/[token]/ # Visitor redemption
│       │   ├── settings/       # User settings
│       │   └── page.tsx        # Landing/dashboard
│       ├── components/         # React components
│       │   ├── den-page-client-enhanced.tsx  # Primary den component (Phase 4)
│       │   ├── den-header-enhanced.tsx       # Header with sync/visitor UI
│       │   ├── invite-page-client.tsx        # Invite redemption + DenKey storage
│       │   └── settings/
│       │       └── dropbox-section.tsx       # Letterbox UI (Phase 4)
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utilities, Supabase client
│       ├── providers/          # Context providers (P2PProvider via initP2P)
│       ├── stores/             # Zustand stores
│       └── types/              # App-specific types
│
└── packages/
    ├── analyzer/               # On-device emotion & transcription ✅
    ├── crypto/                 # All encryption (AES-GCM, PBKDF2, NaCl) ✅
    ├── voice/                  # Voice recording lifecycle ✅
    ├── local-store/            # Yjs docs + IndexedDB persistence ✅
    ├── crdt/                   # Den orchestration + sync machine ✅
    ├── keys/                   # Capability token (DenKey) system ✅
    ├── p2p/                    # WebRTC P2P sync ✅ (integration ~85% complete)
    ├── types/                  # Shared domain types ✅
    ├── ui/                     # Shared component library ✅
    ├── utils/                  # General utilities ✅
    └── config/                 # Environment validation ✅
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
  - [x] Audio feature extraction (pitch, energy, speaking rate—no model needed)
  - [x] Whisper tiny integration (WASM, ~75 MB)
  - [x] Emotion text classifier (ONNX, ~40 MB)
  - [x] Signal fusion (acoustic + semantic)
  - [x] React hooks: `useModelStatus`, `usePreloadModels`, `useAnalyzeVoice`
- [x] `@meerkat/voice` — recording state machine, encryption, storage
  - [x] `useVoiceRecorder` hook (recording → preview → save pipeline)
  - [x] `useVoicePlayer` hook (playback with decryption)
  - [x] Encrypted blob upload to Supabase Storage
- [x] Voice UI components in web app
  - [x] Recorder button with waveform visualization
  - [x] Voice memo list with playback controls
  - [x] Mood badge display (happy, sad, angry, etc.)

**Exit Criteria Met ✅**: Record a voice memo, analyze mood on-device, encrypt, upload, and store. View mood data and transcript without sending audio to server.

---

### ✅ Phase 3: Capability Tokens (Flower Pots) (COMPLETE)

**Goal**: Secure, scoped access control for visitors

- [x] `@meerkat/keys` — DenKey generation, sealing, redemption
  - [x] Key type presets: Come Over, Letterbox, House-sit, Peek
  - [x] Namespace scoping (sharedNotes, voiceThread, dropbox, presence)
  - [x] Expiry + validation (`validateKey()` with null = no-expiry support)
  - [x] React hooks: `useGenerateKey`, `useRedeemKey`, `useStoredKeys`
- [x] Server API (REST — Next.js Route Handlers)
  - [x] `POST /api/flower-pots` — deposit sealed bundle, returns token
  - [x] `GET /api/flower-pots?token=X` — fetch bundle for redemption (public)
  - [x] `DELETE /api/flower-pots?token=X` — revoke token (creator only)
- [x] Web UI
  - [x] Invite modal generates DenKey + flower pot on link creation
  - [x] Invite URL embeds ephemeral secret key in hash fragment (`#sk=BASE64`) — never sent to server
  - [x] Invite acceptance page (`invite-page-client.tsx`) redeems DenKey automatically on join
  - [x] DenKey stored in `localStorage` (`meerkat:den-keys`) for P2P use
  - [x] Key type selector (Come Over / Letterbox / House-sit / Peek) in InviteModal
  - [x] Expiry duration picker in InviteModal
  - [x] Link preview shows preset emoji + name + expiry summary
- [x] Supabase schema
  - [x] `flower_pots` table with RLS policies
  - [x] `den_invites.flower_pot_token` column
- [x] Link regeneration on keyType/duration change

> See [docs/INVITE_DENKEY_FLOW.md](./INVITE_DENKEY_FLOW.md) for full architecture and verification checklist.

**Exit Criteria Met ✅**: Host invites someone via InviteModal → invitee accepts link → DenKey stored in their localStorage → ready for P2P auto-join. Server stores only opaque ciphertext.

---

### 🚧 Phase 4: Peer-to-Peer Sync (~85% Complete)

**Goal**: WebRTC direct connections for real-time Yjs sync

#### Package Implementation ✅ (100% Complete)

- [x] `@meerkat/p2p` — full core architecture implemented and tested
  - [x] P2PManager (singleton adapter for `@meerkat/crdt`)
  - [x] HostManager (one per hosted den) — Supabase Realtime signaling, WebRTC offer/answer
  - [x] VisitorConnection (one per visited den) — WebRTC join, Yjs sync via RTCDataChannel
  - [x] Signaling via Supabase Realtime broadcast channel
  - [x] Yjs sync over RTCDataChannel (<100ms latency peer-to-peer)
  - [x] OfflineDropManager (Letterbox async upload/collect)
  - [x] README documentation
  - [x] Unit + integration tests (26 passing)

#### `@meerkat/crdt` Integration ✅ (100% Complete)

- [x] `resolveP2PAdapter()` — dynamic import of `@meerkat/p2p`, graceful fallback to `offlineAdapter`
  - Singleton caching prevents re-imports
  - Type-safe via `packages/crdt/src/p2p-types.d.ts` declarations
- [x] `DenSyncMachine` state transitions fully implemented
  - States: `offline → connecting → synced → hosting`
  - Valid transitions enforced with warning logs for invalid attempts
  - `start()` / `stop()` lifecycle, `subscribe()` for status change notifications
  - Per-den machine registry (one `hostDen()` call per den)
- [x] P2P status propagation to `DenState.syncStatus` in both `useStandaloneDen` and `DenProvider`
- [x] `@meerkat/p2p` declared as optional peer dependency in `crdt/package.json`

> See [docs/P2P_INTEGRATION_COMPLETE.md](./P2P_INTEGRATION_COMPLETE.md) for full integration detail.

#### Web App UI ✅ (100% Complete)

- [x] Sync status badge component (`SyncStatusBadge` in `@meerkat/ui`)
  - States: offline / connecting (animated) / synced / hosting
  - Size variants: sm / default / lg
  - Tooltip + label toggle
  - Visitor count display when hosting
- [x] `MoodBadge` component (Phase 2 complement)
- [x] `VisitorPresenceList` component — connected visitors with avatars/names
- [x] `VoiceRecorderButton` component
- [x] `DenHeaderEnhanced` — shows host status for owners, visitor sync status for non-owners
- [x] "Start hosting" / "Stop hosting" controls
- [x] "Disconnect visitor" button (host only)
- [x] Bug fix: hosting UI no longer stuck on "Not hosting" (added `"synced"` to `isHosting` check)

#### Signaling & Ownership ✅ (Complete)

- [x] `initP2P()` called in `apps/web/app/providers.tsx` (P2PProvider in layout)
- [x] Supabase Realtime channel configured for signaling
- [x] `DenProvider` moved from `layout.tsx` → `page.tsx` (ownership fix)
- [x] `readOnly={!isOwner}` — non-owners no longer auto-broadcast `"host-online"`

#### Visitor Auto-Join ✅ (Complete)

- [x] `useJoinDen` wired in `den-page-client-enhanced.tsx`
- [x] Auto-connects when non-owner has valid DenKey + `localFirstStorage` + `p2pSync` feature flags enabled
- [x] `DenHeaderEnhanced` correctly shows visitor sync status (not host status) for non-owners

#### Offline Letterbox Flow 🔄 (Partially Complete)

- [x] `OfflineDropManager` implemented in `@meerkat/p2p`
- [x] Dropbox UI — "Dropbox" tab in settings (`dropbox-section.tsx`) shows pending items
- [ ] **TODO**: Visitor upload path — encrypted drop upload when host is offline
- [ ] **TODO**: Host collect path — auto-collect pending drops on den open / reconnect

#### Testing & Polish ❌ (Not Started)

- [ ] Multi-device testing (Chrome + Firefox)
- [ ] Firewall/NAT traversal verification
- [ ] Graceful disconnect handling (network loss mid-session)
- [ ] Connection retry logic
- [ ] STUN/TURN server config for symmetric NAT (optional, low priority)

#### Known Limitations (Phase 4)

- **Namespace keys are placeholders**: `generateDenNamespaceKeys()` creates structurally valid keys but the host's real namespace key material is not yet transferred to visitors. Full namespace-level content encryption is Phase 5.
- **Single flower pot per invite**: Each link carries exactly one DenKey. Lost localStorage = need new invite.
- **No re-request UI**: DenKey redemption failure is non-fatal and silent. No retry button yet.
- **STUN/TURN**: Works on same network or without symmetric NAT. Production TURN server pending.

**Phase 4 Exit Criteria Status**:

1. ✅ Host opens den → `syncStatus: "hosting"` (UI reflects this immediately)
2. ✅ Visitor accepts invite → DenKey stored in localStorage automatically
3. ✅ Visitor opens den → `useJoinDen` auto-connects via WebRTC → `syncStatus: "synced"`
4. ✅ Host creates a note → visitor sees it within 1 second
5. ✅ Host goes offline → visitor `syncStatus: "offline"`, content cached
6. ❌ Letterbox visitor uploads drop when offline → host imports on reconnect (Letterbox flow incomplete)

**Remaining for Phase 4 completion**: Letterbox upload/collect paths + multi-device testing.

---

### 📋 Phase 5: Polish & Hardening (PLANNED)

**Goal**: Production-ready UX and security

#### Features

- [ ] Block-based editor (similar to Notion)
  - [ ] Text block, heading block, list block
  - [ ] Voice block (inline playback)
  - [ ] Drag-and-drop reordering
  - [ ] `/` command menu
- [ ] Advanced search
  - [ ] Full-text search across notes
  - [ ] Filter by mood, date, tags
  - [ ] Search within transcripts
- [ ] Settings & preferences
  - [ ] Theme (light/dark/auto)
  - [ ] Voice recording format (webm/ogg)
  - [ ] Default note privacy (private/shared)
  - [ ] Auto-transcribe toggle
- [ ] Backup & restore
  - [ ] Export den as encrypted JSON
  - [ ] Import on new device
  - [ ] Verify integrity via Yjs state vectors
- [ ] Mobile responsiveness
  - [ ] Touch-friendly voice recorder
  - [ ] Mobile-optimized editor
  - [ ] PWA manifest + service worker
- [ ] Full namespace key transfer (real scoped encryption for visitor content access)
- [ ] DenKey re-request UI (retry button when redemption fails)
- [ ] TURN server configuration for production NAT traversal

#### Security Hardening

- [ ] Content Security Policy (CSP) headers
- [ ] Subresource Integrity (SRI) for CDN assets
- [ ] Rate limiting on flower pot creation/redemption
- [ ] Audit logging (client-side, encrypted)
- [ ] Key rotation support (device key)
- [ ] Namespace key rotation (den owner)

#### Performance

- [ ] Lazy-load Yjs docs (only open den when needed)
- [ ] Virtual scrolling for long note lists
- [ ] Debounced auto-save
- [ ] IndexedDB compaction
- [ ] WASM model loading optimization

#### Testing

- [ ] E2E tests (Playwright)
  - [ ] Auth flow
  - [ ] Note CRUD
  - [ ] Voice recording & playback
  - [ ] Key redemption & P2P sync
- [ ] Unit tests (80%+ coverage)
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
  ├─► @meerkat/keys (for visitor flows)
  │
  ├─► @meerkat/ui
  │
  └─► @meerkat/utils
```

---

## Key Design Decisions

### 1. Why two Yjs documents?

`private.ydoc` holds content only the owner sees (device-encrypted at rest). `shared.ydoc` holds content synced to visitors via P2P. Splitting them means the P2P layer never touches private content — namespace isolation at the document level.

### 2. Why REST for flower pots, not tRPC?

The `/api/flower-pots` endpoint needs to be publicly accessible (GET, no auth) for invite redemption. tRPC requires an authenticated session. REST route handlers map more naturally to this mixed-auth pattern.

### 3. Why hash fragment for secret key delivery?

`/invite/TOKEN#sk=BASE64` — the hash fragment is never sent to the server in HTTP requests. This gives zero-knowledge delivery: the server issues the token but cannot read the secret key used to unseal the bundle.

### 4. Why optional peer dependency for `@meerkat/p2p`?

`@meerkat/crdt` works fully offline without P2P. The optional peer dep + dynamic import pattern means apps can ship Phase 1–3 features without bundling any P2P/WebRTC code. P2P is loaded lazily only when available.

---

## Development Workflow

### Setup

```bash
git clone https://github.com/hari2309s/meerkat.git
cd meerkat
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
pnpm dev
```

### Common Commands

```bash
pnpm dev              # Start all dev servers
pnpm dev:web          # Start only the web app
pnpm build            # Build all packages + web app
pnpm lint             # Lint all packages
pnpm type-check       # TypeScript type checking
pnpm test             # Run all tests (Vitest)
pnpm format           # Format with Prettier
```

### Package-specific

```bash
pnpm --filter @meerkat/crypto test
pnpm --filter @meerkat/analyzer build
pnpm --filter @meerkat/web dev
```

---

## Testing Strategy

### Unit Tests (Vitest)

- `@meerkat/crypto` — encryption/decryption paths, key derivation edge cases
- `@meerkat/analyzer` — audio feature extraction, emotion classification, signal fusion
- `@meerkat/voice` — state machine transitions, save pipeline mocks
- `@meerkat/local-store` — CRUD operations, Yjs observers, IndexedDB persistence
- `@meerkat/keys` — key generation, validation, expiry, namespace scoping
- `@meerkat/p2p` — signaling protocol, WebRTC setup, Yjs sync (26 tests passing)
- `@meerkat/crdt` — sync machine state transitions (note: some invalid-transition warnings in tests are expected/intentional)

### Integration Tests

- Full voice recording pipeline (record → analyze → encrypt → upload → store)
- Multi-device P2P sync (simulated via two HostManager instances)
- Key redemption flow (generate → deposit → redeem → validate)

### E2E Tests (Planned - Playwright, Phase 5)

- Auth: signup, login, password reset
- Notes: create, edit, delete, search
- Voice: record, analyze, playback
- P2P: host den, visitor joins, real-time sync
- Keys: generate, share, redeem, revoke

---

## Security Model

| Threat                | Mitigation                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Server compromise     | Server never holds plaintext. AES-GCM-256 at rest. IndexedDB encrypted.                                                             |
| Malicious visitor     | Namespace scoping enforced by `@meerkat/p2p`. Visitor cannot access `private.ydoc`. Read-only keys enforced (Yjs updates discarded). |
| Token theft           | Tokens expire. Host can revoke at any time. Visitor must hold secret key to decrypt bundle.                                          |
| Audio/transcript leak | Never sent to server. Whisper and emotion classifier run entirely in WASM/ONNX.                                                      |
| Non-owner hosting     | `readOnly={!isOwner}` on DenProvider prevents non-owners from broadcasting `"host-online"`.                                          |

---

## Future Roadmap

### Rich Text Editor

Yjs has excellent rich-text support via `Y.XmlFragment` or `Y.Text` with deltas — foundation for the block-based editor in Phase 5.

### Mobile App

React Native app sharing `@meerkat/*` packages (Expo + bare workflow for crypto/WebRTC). All packages are platform-agnostic TypeScript.

### End-to-End Encrypted Group Chats

`shared.ydoc` is currently 1:N (host to visitors). N:N collaboration requires MLS (Message Layer Security) or similar group key agreement.

### AI Features (Privacy-Preserving)

- Smart search via local semantic embeddings (`@xenova/transformers`)
- Auto-tagging and note categorisation on-device
- Mood trend visualisation over time (foundation already in `@meerkat/local-store` as `moodJournal`)
- Voice commands via iOS Shortcuts integration

---

## Contributing

### Code Style

- TypeScript strict mode, no `any` (use `unknown` + type guards)
- ESLint + Prettier (`pnpm format` before committing)
- Prefer pure functions; exceptions: `DenSyncMachine`, `OfflineDropManager`
- React: functional components + hooks only

### Commit Message Format

```
[scope] -- description

Examples:
[packages/crypto] -- add PBKDF2 iteration count constant
[web] -- update den page layout for mobile
[chore] -- update README and package.json
```

### Pull Request Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Type checking passes (`pnpm type-check`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Added tests for new features
- [ ] Updated relevant README.md files
- [ ] No `console.log` statements
- [ ] No secrets in code

---

## Resources

- [Yjs Docs](https://docs.yjs.dev/)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Transformers.js (Whisper)](https://huggingface.co/docs/transformers.js/)
- [Local-First Software](https://www.inkandswitch.com/local-first/)
- [packages/crdt/README.md](../packages/crdt/README.md)
- [packages/p2p/README.md](../packages/p2p/README.md)
- [packages/keys/README.md](../packages/keys/README.md)
- [docs/P2P_INTEGRATION_COMPLETE.md](./P2P_INTEGRATION_COMPLETE.md)
- [docs/INVITE_DENKEY_FLOW.md](./INVITE_DENKEY_FLOW.md)

---

## License

ISC License. See [LICENSE](./LICENSE) file.