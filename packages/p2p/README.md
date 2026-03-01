# @meerkat/p2p

WebRTC peer connections for Meerkat visitor sessions.

> **The door closes when you leave.** Visitors connect directly to your device when you're online. The server relays only the WebRTC handshake — content never touches it.

---

## How it works

```
VISITOR                       SERVER                       HOST
   |                     (Supabase Realtime)                 |
   |── join-request (SDP offer) ─────────────────────────►  |
   |                                                         |── validates DenKey
   |◄── join-response (SDP answer) ─────────────────────────|
   |                                                         |
   |←──────── ICE candidates (both ways, via TURN if NAT) ─►|
   |                                                         |
   |◄══════════════ RTCDataChannel open ══════════════════► |
   |                                                         |
   |◄─────────── Yjs sync (scoped by DenKey) ───────────────|
```

Signaling uses **Supabase Realtime broadcast** — zero additional server infrastructure. Once the WebRTC connection is established, all Yjs updates flow directly peer-to-peer (or via TURN relay when NAT blocks direct paths).

---

## Setup

### 1. Initialize once at app startup

Call `initP2P()` synchronously during render inside a provider component that wraps den pages. It **must not** be deferred to a `useEffect` — the singleton must exist before any child component effects attempt to use it.

```tsx
// apps/web/providers/p2p-provider.tsx
"use client";
import { initP2P, getP2PManager } from "@meerkat/p2p";
import { createClient } from "@/lib/supabase/client";

export function P2PProvider({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined") {
    try {
      getP2PManager(); // no-op if already initialised
    } catch {
      initP2P({
        createSignalingChannel: (name) => createClient().channel(name),
      });
    }
  }
  return <>{children}</>;
}
```

### 2. Visitor must use a SEPARATE Supabase client

> ⚠️ **Critical**: Do NOT pass `createClient()` into the visitor's `p2pOptions`.
>
> `createClient()` returns a cached singleton that shares a WebSocket with the host's `P2PProvider`. Supabase Realtime does not deliver broadcast messages back to the sending socket — so if both peers share the same connection, the visitor silently receives **zero ICE candidates** from the host and the WebRTC handshake stalls permanently.

Use `createBrowserClient()` directly to get a fresh, independent WebSocket:

```tsx
// apps/web/components/den-page-client-enhanced.tsx
import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@meerkat/config";

const p2pOptions = useMemo<P2PManagerOptions>(() => {
  // Fresh client = dedicated WebSocket = ICE candidates actually arrive
  const supabase = createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return {
    createSignalingChannel: (channelName: string) => {
      const ch = supabase.channel(channelName);
      return {
        on(event, config, callback) {
          ch.on(event, config, callback);
          return this;
        },
        subscribe(cb) {
          ch.subscribe(cb);
          return this;
        },
        async send(args) {
          await ch.send(args);
        },
        async unsubscribe() {
          await supabase.removeChannel(ch);
        },
      };
    },
  };
}, []); // empty deps — intentional, supabase client is stable for session lifetime
```

### 3. Configure TURN servers (required for cross-network connections)

STUN alone fails when both peers are behind home routers (symmetric NAT). TURN relay is required for real-world use outside the same local network.

Set these environment variables in Vercel:

```bash
# Option A: Metered.ca (free tier — sign up at metered.ca, copy from TURN Credentials tab)
NEXT_PUBLIC_METERED_TURN_HOST=global.relay.metered.ca
NEXT_PUBLIC_METERED_TURN_USERNAME=<username from dashboard>
NEXT_PUBLIC_METERED_TURN_CREDENTIAL=<credential from dashboard>

# Option B: Cloudflare TURN (Cloudflare Calls — free tier available)
NEXT_PUBLIC_CF_TURN_USERNAME=<generated username>
NEXT_PUBLIC_CF_TURN_CREDENTIAL=<generated credential>
```

`buildIceServers()` in `lib/signaling.ts` reads these automatically — no code changes needed. If neither is set, a hardcoded public free-tier fallback is used (rate-limited, unreliable, not suitable for production).

**Verify TURN is working** — visitor console after connecting:

```
[@meerkat/p2p] Using Metered.ca TURN: global.relay.metered.ca
[@meerkat/p2p:visitor] ICE: 7 servers, TURN relay: ✅ YES
[@meerkat/p2p:visitor] Gathered: type=relay proto=udp ✅ RELAY
[@meerkat/p2p:visitor] ICE → connected
```

---

## Architecture

```
@meerkat/p2p
│
├── lib/
│   ├── p2p-manager.ts        ← P2PManager singleton (implements P2PAdapter for @meerkat/crdt)
│   ├── host-manager.ts       ← one HostManager per den being hosted
│   ├── visitor-connection.ts ← one VisitorConnection per den being visited
│   ├── signaling.ts          ← Supabase Realtime broadcast wrapper + buildIceServers()
│   ├── yjs-sync.ts           ← y-protocols sync over RTCDataChannel
│   └── offline-drops.ts      ← Letterbox async upload/collect
│
└── hooks.ts                  ← useHostStatus, useVisitorPresence, useJoinDen
```

---

## API

### Host side

```tsx
import { useHostStatus, useVisitorPresence } from "@meerkat/p2p";

// Sync status + hosting controls
const { isOnline, visitorCount, syncStatus, startHosting, stopHosting } =
  useHostStatus(denId);

// Live visitor list
const { visitors, disconnectVisitor } = useVisitorPresence(denId);
```

Hosting starts automatically via `@meerkat/crdt`'s `DenSyncMachine` when `DenProvider` mounts (for owners only — `readOnly={!isOwner}` prevents visitors from hosting). `startHosting` / `stopHosting` are for manual UI controls.

### Visitor side

```tsx
import { useJoinDen } from "@meerkat/p2p";

const { join, status, error, disconnect } = useJoinDen(p2pOptions);

// Auto-join when a valid DenKey becomes available
// NOTE: do NOT include `status` in deps — that causes an infinite retry loop
useEffect(() => {
  if (!isOwner && activeDenKey) {
    join(activeDenKey).catch(console.warn);
  }
}, [isOwner, activeDenKey, join]);
```

`status` values: `"offline"` | `"connecting"` | `"synced"`

---

## WebRTC Handshake — Roles and Order

Roles are fixed: visitor is always the **offerer**, host is always the **answerer**.

```
VISITOR (offerer)                              HOST (answerer)
─────────────────                              ──────────────
1. Register ALL broadcast listeners
   (must happen before subscribe — Supabase
   drops messages with no registered handler)
2. signaling.connect()  ← .subscribe()
3. Wait for host-online (6 s timeout)
4. peer.createDataChannel()  ← BEFORE createOffer
   (embeds channel negotiation into SDP)
5. peer.createOffer()
6. peer.setLocalDescription(offer)
7. signaling.sendJoinRequest(offer) ────────►  8. validateKey()
                                               9. peer.setRemoteDescription(offer)
                                              10. peer.createAnswer()
                                              11. peer.setLocalDescription(answer)
                        ◄──────────────────── 12. signaling.sendJoinResponse(answer)
13. peer.setRemoteDescription(answer)
14. ICE gathering (host + relay candidates)
    ◄────── exchange ICE candidates ────────►
15. ICE → connected
16. peer.ondatachannel → dataChannel.onopen    17. peer.ondatachannel → dataChannel.onopen
17. wireYjsSync() → status "synced"            18. wireYjsSync() → status "hosting"
```

**Three invariants that must hold:**

1. All `.on("broadcast", ...)` registrations happen **before** `.subscribe()` — Supabase requirement
2. Visitor calls `createDataChannel()` before `createOffer()` — WebRTC spec requirement (offerer controls channel negotiation in SDP)
3. Visitor uses a **separate** Supabase client from the host — to avoid self-delivery suppression on the shared WebSocket

---

## Scope Enforcement

| Key type  | Namespaces synced                              | Write? | Live P2P?          |
| --------- | ---------------------------------------------- | ------ | ------------------ |
| Come Over | sharedNotes + voiceThread + presence           | ✅     | ✅                 |
| House-sit | sharedNotes + voiceThread + dropbox + presence | ✅     | ✅                 |
| Peek      | sharedNotes + presence                         | ❌     | ✅                 |
| Letterbox | dropbox only                                   | ✅     | ❌ (offline drops) |

The host passes only `shared.ydoc` (never `private.ydoc`) to `wireScopedYjsSync`. For read-only keys (`canWrite: false`), the visitor's local Yjs updates are silently discarded before transmission.

---

## Security

- **Server blindness**: Supabase sees only SDP/ICE signaling messages. Den content flows peer-to-peer over the RTCDataChannel.
- **DTLS-SRTP**: All WebRTC data channel traffic is end-to-end encrypted by the browser.
- **DenKey validation**: Host validates the visitor's DenKey (expiry, `denId` match) before accepting the handshake.
- **Namespace isolation**: Visitor can only read namespaces included in their DenKey's `namespaceKeys`. Other namespace content remains encrypted with keys the visitor doesn't hold.
- **No persistent visitor identity**: `visitorId` is a random UUID generated per session.

---

## Debugging

### Console log reference — happy path

```
# Visitor
[@meerkat/p2p] Using Metered.ca TURN: global.relay.metered.ca
[@meerkat/p2p:visitor] ICE: 7 servers, TURN relay: ✅ YES
[@meerkat/p2p:visitor] Subscribing...
[@meerkat/p2p:visitor] ✅ Subscribed
[@meerkat/p2p:visitor] ✅ host-online den=<denId>
[@meerkat/p2p:visitor] join-request sent
[@meerkat/p2p:visitor] join-response: accepted=true
[@meerkat/p2p:visitor] Gathered: type=host proto=udp
[@meerkat/p2p:visitor] Gathered: type=srflx proto=udp
[@meerkat/p2p:visitor] Gathered: type=relay proto=udp ✅ RELAY
[@meerkat/p2p:visitor] ICE from host: type=relay ✅ RELAY
[@meerkat/p2p:visitor] ICE → connected
[@meerkat/p2p:visitor] Connection → connected
[@meerkat/p2p:visitor] ✅ DataChannel OPEN
[@meerkat/p2p:visitor] ✅ Yjs synced
[@meerkat/p2p:visitor] Status: connecting → synced

# Host
[@meerkat/p2p:host] join-request received from visitorId=<id>
[@meerkat/p2p:host] ✅ join-response sent to visitorId=<id>
[@meerkat/p2p:host] Sending ICE candidate type=host proto=udp to visitorId=<id>
[@meerkat/p2p:host] Sending ICE candidate type=relay proto=udp to visitorId=<id>
[@meerkat/p2p:host] ICE state for <id> → connected
[@meerkat/p2p:host] ondatachannel fired label=yjs-sync
[@meerkat/p2p:host] DataChannel OPEN for visitorId=<id>
[@meerkat/p2p:host] ✅ Yjs sync wired for visitorId=<id>
[@meerkat/p2p:host] Status: synced → hosting
```

### Failure diagnosis

| Symptom                                        | Cause                                                                        | Fix                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `TURN relay: ❌ NO` then ICE fails             | No TURN env vars set, or wrong credentials                                   | Set `NEXT_PUBLIC_METERED_TURN_*` in Vercel and redeploy                                |
| Visitor receives zero ICE candidates from host | Host and visitor share same Supabase WebSocket (singleton)                   | Use `createBrowserClient()` for visitor `p2pOptions`, not `createClient()`             |
| `host-online` never received                   | Broadcast listener registered after `.subscribe()`                           | Register all `.on()` handlers before calling `signaling.connect()`                     |
| DataChannel never opens despite ICE connected  | Host called `createDataChannel()` instead of using `ondatachannel`           | Visitor creates channel before `createOffer()`; host receives via `peer.ondatachannel` |
| Auto-join retrying in infinite loop            | `visitorStatus` included in `useEffect` deps                                 | Remove `visitorStatus` from deps array — only re-join when key changes                 |
| Yjs sync never starts                          | `openDen()` throws (IndexedDB not available or `localFirstStorage` flag off) | Verify `NEXT_PUBLIC_FF_LOCAL_FIRST=true` and IndexedDB is accessible                   |

---

## Known Limitations

- **Namespace key placeholders**: `generateDenNamespaceKeys()` creates structurally valid keys but real namespace-level content encryption (transferring the host's actual namespace key material to the visitor) is Phase 5.
- **Letterbox offline drops**: `OfflineDropManager` is implemented but the visitor upload path and host auto-collect path are not yet wired in the web app (Phase 5).
- **Single flower pot per invite**: Lost localStorage means the visitor needs a fresh invite link.
- **No re-request UI**: DenKey redemption failure is non-fatal and silent — no retry button yet.
