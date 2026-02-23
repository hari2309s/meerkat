// ─── signaling.ts ─────────────────────────────────────────────────────────────
//
// Supabase Realtime broadcast channel wrapper for WebRTC signaling.
//
// All WebRTC handshake messages (offer, answer, ICE candidates, host presence)
// flow through a single Realtime broadcast channel per den:
//
//   Channel name: p2p:den:{denId}
//
// Why Supabase Realtime?
//   - Already in the stack (auth uses it)
//   - Pure pub/sub — no database rows, no RLS complexity
//   - Low-latency broadcast to all subscribers
//   - The server never interprets these messages — just relays bytes
//
// Message flow:
//   HOST   subscribes and listens for "join-request", "ice-candidate:visitor"
//   VISITOR subscribes and listens for "join-response", "ice-candidate:host",
//           "host-online", "host-offline"
//
// All events are namespaced to avoid cross-talk on the same channel.

import type {
  SupabaseRealtimeChannelLike,
  SignalMessage,
  JoinRequestSignal,
  JoinResponseSignal,
  IceCandidateSignal,
  HostOnlineSignal,
  HostOfflineSignal,
} from "../types";

export const SIGNAL_EVENTS = {
  JOIN_REQUEST: "join-request",
  JOIN_RESPONSE: "join-response",
  ICE_CANDIDATE: "ice-candidate",
  HOST_ONLINE: "host-online",
  HOST_OFFLINE: "host-offline",
} as const;

type SignalEventName = (typeof SIGNAL_EVENTS)[keyof typeof SIGNAL_EVENTS];

type SignalHandler<T extends SignalMessage> = (msg: T) => void;

// ─── SignalingChannel ─────────────────────────────────────────────────────────

/**
 * Wraps a Supabase Realtime broadcast channel with typed signal methods.
 *
 * One instance per den per side (host or visitor). Created by passing the
 * channel factory from P2PManagerOptions.
 *
 * @example
 * ```ts
 * const sig = new SignalingChannel(
 *   createSupabaseChannel(`p2p:den:${denId}`),
 *   denId,
 * );
 * await sig.connect();
 *
 * // Host: listen for join requests
 * const off = sig.onJoinRequest((msg) => handleJoin(msg));
 *
 * // Visitor: send a join request
 * await sig.sendJoinRequest({ ... });
 *
 * // Cleanup
 * off(); // remove listener
 * await sig.disconnect();
 * ```
 */
export class SignalingChannel {
  private readonly channel: SupabaseRealtimeChannelLike;
  private readonly denId: string;
  private connected = false;

  constructor(channel: SupabaseRealtimeChannelLike, denId: string) {
    this.channel = channel;
    this.denId = denId;
  }

  // ── Connection lifecycle ──────────────────────────────────────────────────

  /**
   * Subscribe to the Realtime channel.
   * Returns a promise that resolves when the channel is SUBSCRIBED.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `[@meerkat/p2p] Signaling channel timed out subscribing to p2p:den:${this.denId}`,
          ),
        );
      }, 10_000);

      this.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.connected = true;
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(
            new Error(
              `[@meerkat/p2p] Signaling channel error: ${status} for p2p:den:${this.denId}`,
            ),
          );
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    await this.channel.unsubscribe();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  /**
   * Listen for a specific broadcast event. Returns an unsubscribe function.
   * The Supabase Realtime API attaches all listeners before subscribing,
   * so call `on*` before `connect()`.
   */
  private on<T extends SignalMessage>(
    event: SignalEventName,
    handler: SignalHandler<T>,
  ): () => void {
    this.channel.on("broadcast", { event }, (payload) => {
      handler(payload.payload as T);
    });
    // Supabase Realtime doesn't support removing individual broadcast listeners
    // via the JS SDK — the channel must be unsubscribed and recreated to stop.
    // We return a no-op so callers can treat it uniformly with other cleanup fns.
    return () => {
      /* listener removal not supported; disconnect the channel to stop all */
    };
  }

  onJoinRequest(handler: SignalHandler<JoinRequestSignal>): () => void {
    return this.on(SIGNAL_EVENTS.JOIN_REQUEST, handler);
  }

  onJoinResponse(handler: SignalHandler<JoinResponseSignal>): () => void {
    return this.on(SIGNAL_EVENTS.JOIN_RESPONSE, handler);
  }

  onIceCandidate(handler: SignalHandler<IceCandidateSignal>): () => void {
    return this.on(SIGNAL_EVENTS.ICE_CANDIDATE, handler);
  }

  onHostOnline(handler: SignalHandler<HostOnlineSignal>): () => void {
    return this.on(SIGNAL_EVENTS.HOST_ONLINE, handler);
  }

  onHostOffline(handler: SignalHandler<HostOfflineSignal>): () => void {
    return this.on(SIGNAL_EVENTS.HOST_OFFLINE, handler);
  }

  // ── Senders ───────────────────────────────────────────────────────────────

  async sendJoinRequest(msg: JoinRequestSignal): Promise<void> {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.JOIN_REQUEST,
      payload: msg,
    });
  }

  async sendJoinResponse(msg: JoinResponseSignal): Promise<void> {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.JOIN_RESPONSE,
      payload: msg,
    });
  }

  async sendIceCandidate(msg: IceCandidateSignal): Promise<void> {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.ICE_CANDIDATE,
      payload: msg,
    });
  }

  async broadcastHostOnline(
    msg: Omit<HostOnlineSignal, "type">,
  ): Promise<void> {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.HOST_ONLINE,
      payload: { type: "host-online", ...msg } satisfies HostOnlineSignal,
    });
  }

  async broadcastHostOffline(): Promise<void> {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.HOST_OFFLINE,
      payload: {
        type: "host-offline",
        denId: this.denId,
      } satisfies HostOfflineSignal,
    });
  }
}

// ─── Channel name helper ──────────────────────────────────────────────────────

export function signalingChannelName(denId: string): string {
  return `p2p:den:${denId}`;
}

// ─── Default ICE servers ──────────────────────────────────────────────────────

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
