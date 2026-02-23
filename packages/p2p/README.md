# @meerkat/p2p

WebRTC peer connections for Meerkat visitor sessions.

> **The door closes when you leave.** Visitors connect directly to your device when you're online. The server relays only the WebRTC handshake — content never touches it.

---

## How it works

```
VISITOR                     SERVER                     HOST
   |                    (Supabase Realtime)               |
   |── join-request (SDP offer) ──────────────────────►  |
   |                                                      |── validates DenKey
   |◄── join-response (SDP answer) ─────────────────────  |
   |                                                      |
   |←──────────── ICE candidates (both ways) ───────────►|
   |                                                      |
   |◄═══════════ RTCDataChannel open ══════════════════► |
   |                                                      |
   |◄────────── Yjs sync (scoped by DenKey) ────────────►|
```

Signaling uses **Supabase Realtime broadcast** — zero additional infrastructure. Once the WebRTC connection is established, all Yjs updates flow directly peer-to-peer.

---

## Setup

Call `initP2P()` once at app startup, passing a Supabase channel factory:

```ts
// app/providers.tsx or similar
import { initP2P } from "@meerkat/p2p";
import { createClient } from "@/lib/supabase/client";

initP2P({
  createSignalingChannel: (name) => createClient().channel(name),
  // Optional: custom STUN/TURN servers
  // iceServers: [{ urls: "turn:your-turn.example.com" }],
});
```

`@meerkat/crdt` then picks this up automatically via dynamic import — no further wiring needed.

---

## Architecture

```
@meerkat/p2p
│
├── createP2PAdapter()           ← entry point for @meerkat/crdt
│
├── lib/
│   ├── p2p-manager.ts           ← P2PManager singleton (P2PAdapter impl.)
│   ├── host-manager.ts          ← one HostManager per den being hosted
│   ├── visitor-connection.ts    ← one VisitorConnection per den being visited
│   ├── signaling.ts             ← Supabase Realtime broadcast wrapper
│   ├── yjs-sync.ts              ← y-protocols sync over RTCDataChannel
│   └── offline-drops.ts        ← Letterbox async upload/collect path
│
└── hooks.ts                     ← useHostStatus, useVisitorPresence, useJoinDen
```

---

## API

### Host side

```tsx
import { useHostStatus, useVisitorPresence } from "@meerkat/p2p";

// Is the den accepting connections?
const { isOnline, visitorCount, syncStatus } = useHostStatus(denId);

// Who's here right now?
const { visitors, disconnectVisitor } = useVisitorPresence(denId);

// Kick a visitor
<button onClick={() => disconnectVisitor(visitor.visitorId)}>Remove</button>;
```

### Visitor side

```tsx
import { useJoinDen } from "@meerkat/p2p";
import { createClient } from "@/lib/supabase/client";

const { join, status, error, disconnect } = useJoinDen({
  createSignalingChannel: (name) => createClient().channel(name),
});

// Connect with a redeemed DenKey
await join(redeemedDenKey);
// status: 'connecting' → 'synced'
// shared.ydoc now syncing live with host
```

### Offline Letterbox drops

When the host is offline, visitors with a Letterbox key upload encrypted drops to Supabase Storage. The host imports them on reconnect.

```ts
import { OfflineDropManager } from "@meerkat/p2p";
import { addToDropbox } from "@meerkat/local-store";

// Visitor side: upload drop when host is offline
const mgr = new OfflineDropManager({
  uploadDrop: async (path, data, meta) => {
    await supabase.storage.from("drops").upload(path, data, {
      metadata: meta,
    });
  },
  listDrops: async (prefix) => {
    const { data } = await supabase.storage.from("drops").list(prefix);
    return data?.map((f) => `${prefix}${f.name}`) ?? [];
  },
  downloadDrop: async (path) => {
    const { data } = await supabase.storage.from("drops").download(path);
    const bytes = new Uint8Array(await data!.arrayBuffer());
    // metadata stored in Supabase Storage object metadata
    return { data: bytes, metadata: ... };
  },
  deleteDrop: async (path) => {
    await supabase.storage.from("drops").remove([path]);
  },
});

// Visitor: upload
const drop = await mgr.uploadDrop(denId, visitorId, encryptedBytes, iv);

// Host: collect on reconnect
const drops = await mgr.collectPendingDrops(denId);
for (const drop of drops) {
  await addToDropbox(denId, drop.visitorId, drop.encryptedPayload);
  await mgr.confirmDrop(drop); // deletes from storage
}
```

---

## Scope enforcement

`@meerkat/p2p` enforces the DenKey scope at two levels:

**Document level** — only `shared.ydoc` is ever passed to `wireScopedYjsSync`. `private.ydoc` is never touched. Visitors have zero access to private notes, voice memos, or settings regardless of their key.

**Write level** — `canWrite` is derived from `denKey.scope.write`. For Peek keys (`write: false`), Yjs update messages from the visitor are silently discarded by the host. The visitor can read but every write they attempt is a no-op.

**Validation** — every join request triggers `validateKey(denKey)` on the host. Expired or malformed keys are rejected before any WebRTC state is created.

**Namespace key encryption** — even if a visitor somehow received an update containing `sharedNotes` data, they couldn't decrypt it without the `sharedNotes` namespace key. Their `DenKey.namespaceKeys` only contains bytes for the namespaces their key type grants (enforced in `@meerkat/keys generateKey()`).

---

## Signaling protocol

All signals flow through a single Supabase Realtime broadcast channel per den: `p2p:den:{denId}`.

| Event           | Direction      | Purpose                   |
| --------------- | -------------- | ------------------------- |
| `host-online`   | host → all     | Advertise availability    |
| `host-offline`  | host → all     | Graceful shutdown         |
| `join-request`  | visitor → host | SDP offer + DenKey        |
| `join-response` | host → visitor | SDP answer (or rejection) |
| `ice-candidate` | both           | ICE candidate relay       |

---

## Dependencies

| Package                | Used for                                         |
| ---------------------- | ------------------------------------------------ |
| `@meerkat/keys`        | `validateKey()`, `DenKey` type, `Namespace` type |
| `@meerkat/local-store` | `openDen()`, writing presence to `shared.ydoc`   |
| `yjs`                  | CRDT document model                              |
| `y-protocols`          | Yjs sync protocol messages                       |
| `lib0`                 | Binary encoding/decoding                         |

**No Supabase dependency in package core.** The `createSignalingChannel` factory is caller-provided, keeping the server boundary explicit and the package testable in isolation.

---

## Phase 4 exit criteria

- Open den on device A (host). `syncStatus` transitions to `"connecting"`.
- Open den on device B with a Come Over key token. Both devices show each other's presence. `syncStatus` on both sides shows `"hosting"` and `"synced"` respectively.
- Create a note on A — it appears on B within 1 second via Yjs sync.
- Go offline on A — B's `syncStatus` drops to `"offline"`. B can still read cached content but cannot push new changes.
- Letterbox visitor uploads a drop while host is offline. Host imports it on reconnect via `collectPendingDrops`.
