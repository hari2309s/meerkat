# Meerkat Development Plan

> **Last Updated:** 2026-02-24
> **Status:** Phase 3 Complete | Phase 4 In Progress

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
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utilities, Supabase client
│       ├── providers/          # Context providers
│       ├── stores/             # Zustand stores
│       └── types/              # App-specific types
│
└── packages/
    ├── analyzer/               # On-device emotion & transcription
    ├── crypto/                 # All encryption (AES-GCM, PBKDF2, NaCl)
    ├── voice/                  # Voice recording lifecycle
    ├── local-store/            # Yjs docs + IndexedDB persistence
    ├── crdt/                   # Den orchestration + sync machine
    ├── keys/                   # Capability token (DenKey) system
    ├── p2p/                    # WebRTC P2P sync (Phase 4)
    ├── types/                  # Shared domain types
    ├── ui/                     # Shared component library
    ├── utils/                  # General utilities
    └── config/                 # Environment validation
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

**Exit Criteria**: Create, read, update, delete notes with encrypted at-rest storage. Works offline.

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

**Exit Criteria**: Record a voice memo, analyze mood on-device, encrypt, upload, and store. View mood data and transcript without sending audio to server.

---

### ✅ Phase 3: Capability Tokens (Flower Pots) (COMPLETE)

**Goal**: Secure, scoped access control for visitors

- [x] `@meerkat/keys` — DenKey generation, sealing, redemption
  - [x] Key type presets: Come Over, Letterbox, House-sit, Peek
  - [x] Namespace scoping (sharedNotes, voiceThread, dropbox, presence)
  - [x] Expiry + validation
  - [x] React hooks: `useGenerateKey`, `useRedeemKey`, `useStoredKeys`
- [x] Server API (tRPC)
  - [x] `createFlowerPot` — store encrypted bundle + token
  - [x] `getFlowerPot` — fetch bundle for redemption
  - [x] `deleteFlowerPot` — revoke token
- [x] Web UI
  - [x] Key generation modal (select preset, set duration)
  - [x] Share token via URL (`/invite/[token]`)
  - [x] Redemption page (decrypt bundle, store key locally)
  - [x] Key management (list active keys, revoke)

**Exit Criteria**: Host generates a "Come Over" key, shares token with visitor. Visitor redeems token and stores DenKey locally. Server cannot read key scope or namespace keys.

---

### 🚧 Phase 4: Peer-to-Peer Sync (IN PROGRESS)

**Goal**: WebRTC direct connections for real-time Yjs sync

#### Package Implementation

- [x] `@meerkat/p2p` — core architecture
  - [x] P2PManager (singleton adapter for `@meerkat/crdt`)
  - [x] HostManager (one per hosted den)
  - [x] VisitorConnection (one per visited den)
  - [x] Signaling via Supabase Realtime broadcast
  - [x] Yjs sync over RTCDataChannel
  - [x] OfflineDropManager (Letterbox async upload/collect)
  - [x] README documentation
  - [x] Tests (unit + integration)

#### Integration Tasks

- [ ] Wire `@meerkat/p2p` into `@meerkat/crdt`
  - [ ] Dynamic import resolution in `resolveP2PAdapter()`
  - [ ] `DenSyncMachine` state transitions (offline → connecting → synced → hosting)
  - [ ] P2P status propagation to `DenState.syncStatus`
- [ ] Web app UI
  - [ ] Sync status badge component (offline/connecting/synced/hosting)
  - [ ] Visitor presence display (avatars, names)
  - [ ] "Start hosting" / "Stop hosting" controls
  - [ ] "Disconnect visitor" button (host only)
- [ ] Signaling setup
  - [ ] `initP2P()` call in app/providers.tsx
  - [ ] Supabase Realtime channel configuration
  - [ ] STUN/TURN server config (optional, for NAT traversal)
- [ ] Offline Letterbox flow
  - [ ] Visitor: upload encrypted drop when host offline
  - [ ] Host: collect pending drops on reconnect
  - [ ] UI: "Dropbox" tab in settings with pending items
- [ ] Testing & Polish
  - [ ] Multi-device testing (Chrome + Firefox)
  - [ ] Firewall/NAT traversal verification
  - [ ] Graceful disconnect handling (network loss)
  - [ ] Connection retry logic

**Exit Criteria**:

1. Host opens den → `syncStatus: "hosting"`
2. Visitor redeems Come Over key → connects via WebRTC → `syncStatus: "synced"`
3. Host creates a note → visitor sees it within 1 second
4. Host goes offline → visitor `syncStatus: "offline"`, content cached
5. Letterbox visitor uploads drop when host offline → host imports on reconnect

**Current Blockers**: None. Core P2P package is ready. Focus on integration and UI.

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
  │     ├─► @meerkat/p2p
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

**`private.ydoc`** — never synced, encrypted at-rest with device key, holds private notes and settings.
**`shared.ydoc`** — synced via WebRTC, encrypted per-namespace, served to visitors with valid DenKeys.

**Benefit**: Private content physically cannot leak via P2P. Visitors connect to `shared.ydoc` only.

### 2. Why dual-signal emotion analysis?

**Text-only** misses vocal prosody (flat "I'm fine" reads neutral).
**Audio-only** struggles with very short clips or silence.
**Fusion** gives robust results across all voice memo types. Audio features have no model dependency—analysis works immediately.

### 3. Why capability tokens over traditional ACLs?

**Tokens are self-contained**—no server roundtrip to check permissions. Namespace keys are embedded in the token. A Letterbox visitor physically cannot decrypt `sharedNotes` because they don't have the key bytes.

**Revocation**: Delete the flower pot on the server. The token becomes invalid. Visitor cannot reconnect.

### 4. Why NaCl box for flower pots?

**Forward secrecy per bundle**: Every `encryptBundle()` call generates a fresh ephemeral keypair. Compromising one visitor's secret key doesn't expose other bundles.

**Small keys**: X25519 uses 32-byte keys—easy to store, easy to share.

### 5. Why Supabase Realtime for signaling (not a TURN server)?

**Zero infra overhead**: No need to run a signaling server. Supabase Realtime broadcast handles SDP exchange and ICE candidates.

**Fallback-friendly**: If both peers are behind symmetric NAT and cannot establish a direct connection, TURN can be added later without changing the signaling layer.

---

## Privacy & Security Model

### Data Flow

#### Private Note Creation

```
User types → Yjs private.ydoc → IndexedDB (encrypted with device key)
               ↓
         (never leaves device)
```

#### Voice Memo Recording

```
MediaRecorder → audioBlob (memory only)
                    ↓
          analyzeVoice() (browser WASM + ONNX)
                    ↓
          AnalysisResult { transcript, mood, valence, arousal }
                    ↓
          encryptBlob() (AES-GCM-256, namespace key)
                    ↓
          Supabase Storage (ciphertext only)
                    ↓
          addVoiceMemo() (private.ydoc, IndexedDB)
```

Server sees: `{ data: base64, iv: base64 }` — cannot decrypt.

#### Visitor P2P Session

```
Visitor redeems token (client-side NaCl decryption)
    ↓
DenKey stored locally (includes scoped namespace keys)
    ↓
Signaling via Supabase Realtime (SDP exchange only)
    ↓
WebRTC data channel established (direct P2P)
    ↓
Yjs updates flow over WebRTC (scoped by DenKey.namespaces)
    ↓
Visitor decrypts only the namespaces they have keys for
```

Server sees: Signaling messages, no content.

### Threat Model

| Threat                | Mitigation                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Server compromise     | All content encrypted on-device. Server stores only ciphertext.                                                                      |
| MITM during sync      | WebRTC encrypts all data channel traffic (DTLS-SRTP).                                                                                |
| Stolen device         | Device key derived from passphrase (or could require biometric unlock). At-rest encryption protects IndexedDB.                       |
| Malicious visitor     | Namespace scoping enforced by `@meerkat/p2p`. Visitor cannot access `private.ydoc`. Read-only keys enforced (Yjs updates discarded). |
| Token theft           | Tokens expire. Host can revoke at any time. Visitor must hold secret key to decrypt bundle.                                          |
| Audio/transcript leak | Never sent to server. Whisper and emotion classifier run entirely in WASM/ONNX.                                                      |

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
pnpm dev              # Start all dev servers (web + watch mode for packages)
pnpm dev:web          # Start only the web app
pnpm build            # Build all packages + web app
pnpm lint             # Lint all packages
pnpm type-check       # TypeScript type checking
pnpm test             # Run all tests (Vitest)
pnpm format           # Format with Prettier
```

### Package-specific

```bash
# From root
pnpm --filter @meerkat/crypto test
pnpm --filter @meerkat/analyzer build
pnpm --filter @meerkat/web dev

# Or cd into package
cd packages/crypto
pnpm test:watch
```

---

## Testing Strategy

### Unit Tests (Vitest)

- `@meerkat/crypto` — all encryption/decryption paths, key derivation edge cases
- `@meerkat/analyzer` — audio feature extraction, emotion classification, signal fusion
- `@meerkat/voice` — state machine transitions, save pipeline mocks
- `@meerkat/local-store` — CRUD operations, Yjs observers, IndexedDB persistence
- `@meerkat/keys` — key generation, validation, expiry, namespace scoping
- `@meerkat/p2p` — signaling protocol, WebRTC setup, Yjs sync

### Integration Tests

- Full voice recording pipeline (record → analyze → encrypt → upload → store)
- Multi-device P2P sync (simulated via two HostManager instances)
- Key redemption flow (generate → deposit → redeem → validate)

### E2E Tests (Planned - Playwright)

- Auth: signup, login, password reset
- Notes: create, edit, delete, search
- Voice: record, analyze, playback
- P2P: host den, visitor joins, real-time sync
- Keys: generate, share, redeem, revoke

---

## Deployment

### Vercel (Primary)

```bash
# From apps/web/
vercel --prod
```

**Environment Variables** (Vercel dashboard):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)

**Build Settings**:

- Framework: Next.js
- Build Command: `pnpm build` (runs TurboRepo build)
- Output Directory: `.next`

### Supabase Setup

1. Create project on supabase.com
2. Enable Auth (email/password)
3. Create Storage bucket: `blobs` (private, row-level security)
4. Create table: `flower_pots` (schema below)
5. Enable Realtime for P2P signaling

#### Flower Pots Table Schema

```sql
CREATE TABLE flower_pots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  den_id TEXT NOT NULL,
  encrypted_bundle TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_flower_pots_token ON flower_pots(token);
CREATE INDEX idx_flower_pots_expires_at ON flower_pots(expires_at);
```

#### Row-Level Security (RLS)

```sql
-- Anyone can read non-expired flower pots
CREATE POLICY "Public read non-expired flower pots"
  ON flower_pots FOR SELECT
  USING (expires_at IS NULL OR expires_at > NOW());

-- Only authenticated users can create
CREATE POLICY "Authenticated users can create flower pots"
  ON flower_pots FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only creator can delete
CREATE POLICY "Creator can delete flower pots"
  ON flower_pots FOR DELETE
  USING (auth.uid() = created_by);
```

---

## Performance Considerations

### IndexedDB

- Yjs persists every update immediately (via `y-indexeddb`)
- Large dens (>1000 notes) may see slower initial load—consider lazy loading or pagination
- Periodic compaction recommended (Yjs `Y.encodeStateAsUpdate` → clear → `Y.applyUpdate`)

### WebRTC

- Data channels have no practical message size limit for text
- Voice blobs are NOT sent over WebRTC—only Yjs updates (text content, metadata)
- TURN server recommended for production (NAT traversal)

### WASM Models (Analyzer)

- Whisper tiny: ~75 MB, downloaded once, cached in OPFS
- Emotion classifier: ~40 MB, downloaded once, cached in OPFS
- Audio feature extraction: pure JS, always instant (no download)
- First analysis may take 10-15s (model download + initialization), subsequent analyses <2s

### Encryption

- `crypto.subtle` (Web Crypto API) is hardware-accelerated on modern browsers
- PBKDF2 with 310k iterations takes ~500ms on desktop, ~2s on mobile—acceptable for login flow
- AES-GCM encryption is <10ms per blob even for large voice memos

---

## Open Questions & Future Work

### Multi-Device Sync (Host)

**Current**: Each device has its own `private.ydoc` (encrypted with device-specific key).
**Limitation**: Private notes don't sync across the host's own devices.
**Possible Solution**: Encrypt `private.ydoc` with a user-level key (derived from auth session), store in Supabase Storage, sync on login.

### Voice Memo Streaming

**Current**: Voice memos are uploaded as complete blobs after recording stops.
**Future**: Stream voice data during recording, analyze in chunks, support longer recordings (>10 min).

### Rich Text Editor

**Current**: Notes are plain text.
**Future**: Block-based editor (Notion-style) with voice blocks, images, embeds. Yjs has excellent rich-text support via `Y.XmlFragment` or `Y.Text` with deltas.

### Mobile App

**Current**: Web app is responsive but not a native app.
**Future**: React Native app sharing `@meerkat/*` packages (Expo + bare workflow for crypto/WebRTC). All packages are platform-agnostic TypeScript.

### End-to-End Encrypted Group Chats

**Current**: `shared.ydoc` is 1:N (host to visitors).
**Future**: N:N collaboration (multiple hosts). Requires MLS (Message Layer Security) or similar group key agreement protocol.

### AI Features (Privacy-Preserving)

- **Smart search**: Semantic search over embeddings (run locally via `@xenova/transformers`)
- **Auto-tagging**: Classify notes into categories on-device
- **Mood trends**: Visualize mood history over time (already in `@meerkat/local-store` as `moodJournal`)
- **Voice commands**: "Siri, record a voice note in my Meerkat den" (iOS Shortcuts integration)

---

## Contributing

### Code Style

- TypeScript strict mode
- ESLint + Prettier (run `pnpm format` before committing)
- Prefer pure functions over classes (exceptions: `DenSyncMachine`, `OfflineDropManager`)
- No `any` types—use `unknown` + type guards
- React: functional components + hooks (no class components)

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
- [ ] No `console.log` statements (use proper logging)
- [ ] No secrets in code (use `.env.local`)

---

## Resources

### Documentation

- [Yjs Docs](https://docs.yjs.dev/)
- [y-indexeddb](https://github.com/yjs/y-indexeddb)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Transformers.js (Whisper)](https://huggingface.co/docs/transformers.js/)

### Papers & Articles

- [Yjs CRDT Algorithm](https://github.com/yjs/yjs/blob/main/INTERNALS.md)
- [Russell's Circumplex Model of Affect](https://en.wikipedia.org/wiki/Emotion_classification#Dimensional_models)
- [Local-First Software](https://www.inkandswitch.com/local-first/)
- [Zero-Knowledge Architecture](https://www.netmeister.org/blog/zero-knowledge.html)

### Tools

- [Yjs Debugger (Chrome Extension)](https://github.com/yjs/yjs-chrome-devtools)
- [WebRTC Internals](chrome://webrtc-internals) (Chrome)
- [IndexedDB Explorer](chrome://indexeddb-internals) (Chrome)

---

## License

ISC License. See [LICENSE](./LICENSE) file.

---

## Acknowledgments

- **Yjs** — Kevin Jahns for the CRDT magic
- **Transformers.js** — Xenova for bringing Hugging Face models to the browser
- **TweetNaCl** — Daniel Bernstein for the crypto primitives
- **Supabase** — For the easiest auth + storage setup ever

---

## Contact

- **Maintainer**: Hariharan S ([@hari2309s](https://github.com/hari2309s))
- **Issues**: [GitHub Issues](https://github.com/hari2309s/meerkat/issues)

---

**Generated with Claude Code** 🤖
