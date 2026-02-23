/**
 * @meerkat/p2p
 *
 * WebRTC peer connections for Meerkat visitor sessions.
 *
 * When the host is online and a visitor holds a valid DenKey, they connect
 * directly over WebRTC. The scoped portion of shared.ydoc syncs in real-time
 * between devices. The server is used only for signaling (broadcast) —
 * content never passes through it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Setup (once at app startup)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { getP2PManager } from '@meerkat/p2p'
 *   // The caller provides the signaling channel factory (e.g. from their host)
 *   getP2PManager().init({
 *     createSignalingChannel: (name) => myProvider.channel(name),
 *   })
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration with @meerkat/crdt
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   @meerkat/crdt dynamically imports this package and calls createP2PAdapter().
 *   This is automatic — no extra wiring needed once initP2P() is called.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Host side
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   // Hosting is started automatically by @meerkat/crdt's DenProvider.
 *   // Use these hooks for UI:
 *
 *   const { isOnline, visitorCount, syncStatus } = useHostStatus(denId)
 *   const { visitors, disconnectVisitor } = useVisitorPresence(denId)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Visitor side
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   const { join, status, error, disconnect } = useJoinDen({ createSignalingChannel })
 *   await join(redeemedDenKey)   // DenKey from @meerkat/keys redeemKey()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Offline Letterbox drops
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   // Visitor: upload encrypted drop when host is offline
 *   const mgr = new OfflineDropManager({ uploadDrop, listDrops, downloadDrop, deleteDrop })
 *   await mgr.uploadDrop(denId, visitorId, encryptedBytes, iv)
 *
 *   // Host: collect pending drops on reconnect
 *   const drops = await mgr.collectPendingDrops(denId)
 *   for (const drop of drops) {
 *     await addToDropbox(denId, drop.visitorId, drop.encryptedPayload)
 *     await mgr.confirmDrop(drop)
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Scope enforcement summary
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   | Key type  | Syncs                                     | Write? | Offline |
 *   |-----------|-------------------------------------------|--------|---------|
 *   | come-over | sharedNotes + voiceThread + presence      | ✓      | ✗       |
 *   | letterbox | dropbox (async path only)                 | ✓      | ✓       |
 *   | house-sit | sharedNotes + voiceThread + dropbox + presence | ✓  | ✓       |
 *   | peek      | sharedNotes + presence                    | ✗      | ✗       |
 */

// ─── Core adapter (for @meerkat/crdt) ────────────────────────────────────────
export {
  createP2PAdapter,
  initP2P,
  getP2PManager,
  resetP2PManager,
  P2PManager,
} from "./lib/p2p-manager";

// ─── Offline drops ────────────────────────────────────────────────────────────
export {
  OfflineDropManager,
  dropStoragePath,
  dropStoragePrefix,
} from "./lib/offline-drops";
export type { OfflineDropManagerOptions } from "./lib/offline-drops";

// ─── Signaling helpers ────────────────────────────────────────────────────────
export {
  SignalingChannel,
  signalingChannelName,
  DEFAULT_ICE_SERVERS,
  SIGNAL_EVENTS,
} from "./lib/signaling";

// ─── Host & visitor managers (advanced use / testing) ─────────────────────────
export { HostManager } from "./lib/host-manager";
export { VisitorConnection } from "./lib/visitor-connection";

// ─── Yjs sync helpers ────────────────────────────────────────────────────────
export {
  wireScopedYjsSync,
  getReadableNamespaces,
  getWritableNamespaces,
} from "./lib/yjs-sync";

// ─── React hooks ─────────────────────────────────────────────────────────────
export { useHostStatus, useVisitorPresence, useJoinDen } from "./hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SyncStatus,
  VisitorSession,
  SignalMessage,
  JoinRequestSignal,
  JoinResponseSignal,
  IceCandidateSignal,
  HostOnlineSignal,
  HostOfflineSignal,
  OfflineDrop,
  P2PAdapter,
  P2PManagerOptions,
  SupabaseRealtimeChannelLike,
  UseHostStatusReturn,
  UseVisitorPresenceReturn,
  UseJoinDenReturn,
} from "./types";
