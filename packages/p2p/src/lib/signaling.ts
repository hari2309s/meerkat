// ─── signaling.ts ─────────────────────────────────────────────────────────────
//
// Supabase Realtime broadcast channel wrapper for WebRTC signaling.

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

export class SignalingChannel {
  private readonly channel: SupabaseRealtimeChannelLike;
  private readonly denId: string;
  private connected = false;

  constructor(channel: SupabaseRealtimeChannelLike, denId: string) {
    this.channel = channel;
    this.denId = denId;
  }

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

  private on<T extends SignalMessage>(
    event: SignalEventName,
    handler: SignalHandler<T>,
  ): () => void {
    this.channel.on("broadcast", { event }, (payload) => {
      const msg: T =
        payload &&
        typeof payload === "object" &&
        "payload" in payload &&
        (payload as { payload?: unknown }).payload !== undefined
          ? ((payload as { payload: T }).payload as unknown as T)
          : (payload as unknown as T);
      handler(msg);
    });
    return () => {
      /* Supabase doesn't support individual listener removal */
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

export function signalingChannelName(denId: string): string {
  return `p2p:den:${denId}`;
}

/**
 * ICE server list.
 *
 * STUN alone fails when both peers are behind NAT (home routers / symmetric NAT).
 * TURN relays traffic when direct peer-to-peer is impossible.
 *
 * Using Open Relay Project (free, no account needed, rate-limited but fine for dev/low-traffic):
 *   https://www.metered.ca/tools/openrelay/
 *
 * For production with real users, replace with a dedicated TURN service
 * (Twilio, Metered.ca paid, coturn self-hosted) and put credentials in env vars.
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  // STUN — discover public IP, works when at least one peer is NOT behind NAT
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:openrelay.metered.ca:80" },

  // TURN over UDP (port 80 — passes most firewalls)
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  // TURN over TCP (fallback when UDP is blocked)
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  // TURNS over TLS (port 443 — works through almost any corporate firewall)
  {
    urls: "turns:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];
