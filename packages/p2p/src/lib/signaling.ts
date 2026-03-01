// ─── signaling.ts ─────────────────────────────────────────────────────────────

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
    return () => {};
  }

  onJoinRequest(handler: SignalHandler<JoinRequestSignal>) {
    return this.on(SIGNAL_EVENTS.JOIN_REQUEST, handler);
  }
  onJoinResponse(handler: SignalHandler<JoinResponseSignal>) {
    return this.on(SIGNAL_EVENTS.JOIN_RESPONSE, handler);
  }
  onIceCandidate(handler: SignalHandler<IceCandidateSignal>) {
    return this.on(SIGNAL_EVENTS.ICE_CANDIDATE, handler);
  }
  onHostOnline(handler: SignalHandler<HostOnlineSignal>) {
    return this.on(SIGNAL_EVENTS.HOST_ONLINE, handler);
  }
  onHostOffline(handler: SignalHandler<HostOfflineSignal>) {
    return this.on(SIGNAL_EVENTS.HOST_OFFLINE, handler);
  }

  async sendJoinRequest(msg: JoinRequestSignal) {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.JOIN_REQUEST,
      payload: msg,
    });
  }
  async sendJoinResponse(msg: JoinResponseSignal) {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.JOIN_RESPONSE,
      payload: msg,
    });
  }
  async sendIceCandidate(msg: IceCandidateSignal) {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.ICE_CANDIDATE,
      payload: msg,
    });
  }
  async broadcastHostOnline(msg: Omit<HostOnlineSignal, "type">) {
    await this.channel.send({
      type: "broadcast",
      event: SIGNAL_EVENTS.HOST_ONLINE,
      payload: { type: "host-online", ...msg } satisfies HostOnlineSignal,
    });
  }
  async broadcastHostOffline() {
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
 * Build the ICE server list.
 *
 * Priority:
 *   1. NEXT_PUBLIC_TURN_URLS env var (comma-separated, with credentials)
 *      Format: "turn:host:port?username=u&credential=p,turns:host:port?username=u&credential=p"
 *   2. Metered.ca credentials from env vars (recommended for production)
 *   3. Cloudflare TURN from env vars
 *   4. Hardcoded Metered.ca free-tier fallback (may be rate-limited)
 *
 * For Metered.ca (free tier, reliable):
 *   1. Sign up at https://www.metered.ca/ (free, 2 min)
 *   2. Create an app → copy the TURN credentials from the dashboard
 *   3. Add to Vercel env vars:
 *        NEXT_PUBLIC_METERED_TURN_USERNAME=<your-username>
 *        NEXT_PUBLIC_METERED_TURN_CREDENTIAL=<your-credential>
 *        NEXT_PUBLIC_METERED_TURN_HOST=<your-host>.relay.metered.ca
 *
 * For Cloudflare TURN (free under Cloudflare Calls):
 *   1. https://dash.cloudflare.com → Calls → TURN keys → Create a key
 *   2. Add to Vercel env vars:
 *        NEXT_PUBLIC_CF_TURN_KEY_ID=<key-id>
 *        NEXT_PUBLIC_CF_TURN_KEY_API_TOKEN=<api-token>
 *        (Then call https://rtc.live.cloudflare.com/v1/turn/keys/{id}/credentials/generate)
 *        NEXT_PUBLIC_CF_TURN_USERNAME=<generated-username>
 *        NEXT_PUBLIC_CF_TURN_CREDENTIAL=<generated-credential>
 */
export function buildIceServers(overrides?: RTCIceServer[]): RTCIceServer[] {
  if (overrides && overrides.length > 0) return overrides;

  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // Metered.ca env-var credentials (recommended)
  const meteredHost = process.env.NEXT_PUBLIC_METERED_TURN_HOST;
  const meteredUser = process.env.NEXT_PUBLIC_METERED_TURN_USERNAME;
  const meteredCred = process.env.NEXT_PUBLIC_METERED_TURN_CREDENTIAL;

  if (meteredHost && meteredUser && meteredCred) {
    console.log(`[@meerkat/p2p] Using Metered.ca TURN: ${meteredHost}`);
    servers.push(
      { urls: `stun:${meteredHost}` },
      {
        urls: `turn:${meteredHost}:80?transport=udp`,
        username: meteredUser,
        credential: meteredCred,
      },
      {
        urls: `turn:${meteredHost}:80?transport=tcp`,
        username: meteredUser,
        credential: meteredCred,
      },
      {
        urls: `turn:${meteredHost}:443?transport=tcp`,
        username: meteredUser,
        credential: meteredCred,
      },
      {
        urls: `turns:${meteredHost}:443?transport=tcp`,
        username: meteredUser,
        credential: meteredCred,
      },
    );
    return servers;
  }

  // Cloudflare TURN env-var credentials
  const cfUser = process.env.NEXT_PUBLIC_CF_TURN_USERNAME;
  const cfCred = process.env.NEXT_PUBLIC_CF_TURN_CREDENTIAL;

  if (cfUser && cfCred) {
    console.log(`[@meerkat/p2p] Using Cloudflare TURN`);
    servers.push(
      {
        urls: "turn:turn.cloudflare.com:3478?transport=udp",
        username: cfUser,
        credential: cfCred,
      },
      {
        urls: "turn:turn.cloudflare.com:3478?transport=tcp",
        username: cfUser,
        credential: cfCred,
      },
      {
        urls: "turns:turn.cloudflare.com:5349?transport=tcp",
        username: cfUser,
        credential: cfCred,
      },
    );
    return servers;
  }

  // Fallback: hardcoded Metered free-tier (no account, but rate-limited & unreliable)
  // Remove this block once you have real credentials configured above.
  console.warn(
    "[@meerkat/p2p] No TURN credentials configured — using free public fallback. " +
      "Set NEXT_PUBLIC_METERED_TURN_HOST/USERNAME/CREDENTIAL in Vercel env vars for reliable connections.",
  );
  servers.push(
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "e84722a5e85d41e9de8c3dc2",
      credential: "FpnPCEfTf5aBbUfZ",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "e84722a5e85d41e9de8c3dc2",
      credential: "FpnPCEfTf5aBbUfZ",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "e84722a5e85d41e9de8c3dc2",
      credential: "FpnPCEfTf5aBbUfZ",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "e84722a5e85d41e9de8c3dc2",
      credential: "FpnPCEfTf5aBbUfZ",
    },
  );

  return servers;
}

/** Legacy export — used by existing code that passes iceServers directly */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = buildIceServers();
