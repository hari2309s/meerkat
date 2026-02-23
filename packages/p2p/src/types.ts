// ─── @meerkat/p2p types ──────────────────────────────────────────────────────

import type { DenKey } from "@meerkat/keys";

// ─── Sync status ─────────────────────────────────────────────────────────────

/**
 * The sync state machine lifecycle.
 * Mirrors the SyncStatus in @meerkat/crdt for compatibility with the P2PAdapter.
 *
 *   offline     → no P2P available, or host deliberately not hosting
 *   connecting  → signaling channel joined, waiting for visitor handshake
 *   synced      → visitor connected and Yjs sync is live (visitor side)
 *   hosting     → host is advertising, at least one visitor is connected
 */
export type SyncStatus = "offline" | "connecting" | "synced" | "hosting";

// ─── Visitor session ─────────────────────────────────────────────────────────

/**
 * A live P2P session between host and visitor.
 * Exists on the host side; one per connected visitor.
 */
export interface VisitorSession {
  /** Ephemeral ID — random UUID per connection, not tied to any account. */
  visitorId: string;
  /** The capability scope this visitor was granted. */
  scope: DenKey["scope"];
  /** ISO-8601 timestamp when the WebRTC connection was established. */
  connectedAt: string;
  /** The underlying RTCPeerConnection. Exposed for advanced use and testing. */
  peer: RTCPeerConnection;
  /** Which namespaces are actively syncing for this visitor. */
  activeNamespaces: string[];
}

// ─── Signaling message shapes ─────────────────────────────────────────────────
//
// All signaling messages flow through Supabase Realtime broadcast.
// The channel is: p2p:den:{denId}
// The host listens; visitors broadcast join requests.

export interface SignalBase {
  type: string;
  visitorId: string;
  denId: string;
}

/** Visitor → Host: "I want to connect, here's my key and WebRTC offer." */
export interface JoinRequestSignal extends SignalBase {
  type: "join-request";
  /** Base64-encoded SDP offer. */
  sdpOffer: string;
  /** The visitor's redeemed DenKey (verified by the host). */
  denKey: DenKey;
}

/** Host → Visitor: "Here's my SDP answer." */
export interface JoinResponseSignal extends SignalBase {
  type: "join-response";
  /** Base64-encoded SDP answer. */
  sdpAnswer: string;
  /** Whether the host accepted the connection. */
  accepted: boolean;
  /** Rejection reason if accepted === false. */
  reason?: string;
}

/** Bidirectional: relay ICE candidates during connection establishment. */
export interface IceCandidateSignal extends SignalBase {
  type: "ice-candidate";
  candidate: RTCIceCandidateInit;
  /** "host" or "visitor" — so the receiver knows who sent it. */
  from: "host" | "visitor";
}

/** Host → all: "I'm online and accepting connections." */
export interface HostOnlineSignal {
  type: "host-online";
  denId: string;
  /** Host's public key (for visitors to verify the offer is from the right host). */
  hostPublicKey: string;
}

/** Host → all: "I'm going offline." */
export interface HostOfflineSignal {
  type: "host-offline";
  denId: string;
}

export type SignalMessage =
  | JoinRequestSignal
  | JoinResponseSignal
  | IceCandidateSignal
  | HostOnlineSignal
  | HostOfflineSignal;

// ─── P2P Adapter interface (matches @meerkat/crdt's expectation) ─────────────

/**
 * The interface that @meerkat/crdt imports from @meerkat/p2p.
 * @meerkat/p2p must export createP2PAdapter() which returns this.
 *
 * Kept minimal — @meerkat/crdt only needs status, hosting, and status events.
 * The richer API (joinDen, visitSession management) is used by React hooks.
 */
export interface P2PAdapter {
  /** Start hosting the den: listen for visitor connections. Returns cleanup fn. */
  hostDen(denId: string): () => void;
  /** Returns the current sync status for a den. */
  getStatus(denId: string): SyncStatus;
  /** Subscribe to status changes. Returns unsubscribe fn. */
  onStatusChange(
    denId: string,
    handler: (status: SyncStatus) => void,
  ): () => void;
}

// ─── Offline drop ─────────────────────────────────────────────────────────────

/**
 * A Letterbox drop uploaded to Supabase Storage when the host is offline.
 * The host imports these on reconnect.
 */
export interface OfflineDrop {
  /** Unique drop ID — also the Storage path segment. */
  dropId: string;
  /** The den this drop is for. */
  denId: string;
  /** The visitor who left the drop. */
  visitorId: string;
  /** Encrypted payload bytes (base64) — host decrypts on import. */
  encryptedPayload: string;
  /** IV for the encrypted payload. */
  iv: string;
  /** ISO-8601 timestamp. */
  droppedAt: string;
}

// ─── Hook return types ────────────────────────────────────────────────────────

export interface UseHostStatusReturn {
  /** Whether the host is advertising on the signaling channel. */
  isOnline: boolean;
  /** Number of currently-connected visitors. */
  visitorCount: number;
  /** Current sync status. */
  syncStatus: SyncStatus;
  /** Start hosting (idempotent). */
  startHosting: () => void;
  /** Stop hosting and disconnect all visitors. */
  stopHosting: () => void;
}

export interface UseVisitorPresenceReturn {
  /** Live list of connected visitors. */
  visitors: VisitorSession[];
  /** Disconnect a specific visitor by ID. */
  disconnectVisitor: (visitorId: string) => void;
}

export interface UseJoinDenReturn {
  /** Initiate a connection to the host den. */
  join: (denKey: DenKey) => Promise<void>;
  /** Current connection state. */
  status: SyncStatus;
  /** Non-null if an error occurred. */
  error: string | null;
  /** Disconnect from the den. */
  disconnect: () => void;
}

// ─── P2P manager options ─────────────────────────────────────────────────────

export interface P2PManagerOptions {
  /**
   * A factory for the Supabase Realtime channel.
   * Injected so this package has no hard Supabase dependency in its core logic.
   */
  createSignalingChannel: (channelName: string) => SupabaseRealtimeChannelLike;
  /**
   * STUN/TURN server configuration.
   * Defaults to public Google STUN if not provided.
   */
  iceServers?: RTCIceServer[];
}

/**
 * Minimal interface for a Supabase Realtime broadcast channel.
 * Only the subset that @meerkat/p2p uses.
 */
export interface SupabaseRealtimeChannelLike {
  on(
    event: "broadcast",
    config: { event: string },
    callback: (payload: { payload: unknown }) => void,
  ): this;
  subscribe(callback?: (status: string) => void): this;
  send(args: {
    type: "broadcast";
    event: string;
    payload: unknown;
  }): Promise<void>;
  unsubscribe(): Promise<void>;
}
