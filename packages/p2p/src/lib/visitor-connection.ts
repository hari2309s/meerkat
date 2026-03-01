// ─── visitor-connection.ts ───────────────────────────────────────────────────

import * as awarenessProtocol from "y-protocols/awareness";
import { validateKey } from "@meerkat/keys";
import { openDen } from "@meerkat/local-store";
import type { DenKey } from "@meerkat/keys";
import {
  SignalingChannel,
  buildIceServers,
  signalingChannelName,
} from "./signaling";
import { wireScopedYjsSync } from "./yjs-sync";
import type {
  SyncStatus,
  P2PManagerOptions,
  JoinResponseSignal,
  IceCandidateSignal,
} from "../types";

const DATA_CHANNEL_LABEL = "yjs-sync";
const HOST_ONLINE_WAIT_MS = 6_000;
const HANDSHAKE_TIMEOUT_MS = 15_000;

export class VisitorConnection {
  private readonly denKey: DenKey;
  private readonly hostDenId: string;
  private readonly options: P2PManagerOptions;

  private signaling: SignalingChannel | null = null;
  private peer: RTCPeerConnection | null = null;
  private yjsCleanup: (() => void) | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private statusHandlers = new Set<(status: SyncStatus) => void>();
  private _status: SyncStatus = "offline";

  constructor(denKey: DenKey, hostDenId: string, options: P2PManagerOptions) {
    this.denKey = denKey;
    this.hostDenId = hostDenId;
    this.options = options;
  }

  get status(): SyncStatus {
    return this._status;
  }

  onStatusChange(handler: (status: SyncStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  async connect(visitorId: string): Promise<void> {
    console.log(
      `[@meerkat/p2p:visitor] connect() — visitorId=${visitorId} den=${this.hostDenId}`,
    );
    if (!validateKey(this.denKey))
      throw new Error("[@meerkat/p2p] DenKey is invalid or expired");

    this._setStatus("connecting");

    const rawChannel = this.options.createSignalingChannel(
      signalingChannelName(this.hostDenId),
    );
    this.signaling = new SignalingChannel(rawChannel, this.hostDenId);

    // Build ICE servers — picks up env-var TURN credentials
    const iceServers = buildIceServers(this.options.iceServers);
    const hasRelay = iceServers.some((s) =>
      [s.urls]
        .flat()
        .some(
          (u) =>
            String(u).startsWith("turn:") || String(u).startsWith("turns:"),
        ),
    );
    console.log(
      `[@meerkat/p2p:visitor] ICE: ${iceServers.length} servers, TURN relay: ${hasRelay ? "✅ YES" : "❌ NO — will fail behind NAT"}`,
    );

    const peer = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 2 });
    this.peer = peer;

    // Visitor is offerer — MUST createDataChannel before createOffer()
    const dataChannel = peer.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    dataChannel.onopen = async () => {
      console.log(`[@meerkat/p2p:visitor] ✅ DataChannel OPEN`);
      await this.wireYjsSync(dataChannel);
    };
    dataChannel.onclose = () =>
      console.log(`[@meerkat/p2p:visitor] DataChannel closed`);
    dataChannel.onerror = (e) =>
      console.error(`[@meerkat/p2p:visitor] DataChannel error:`, e);

    // ICE candidate logging — shows whether relay candidates are gathered
    let relayGathered = false;
    peer.onicecandidate = async ({ candidate }) => {
      if (!candidate) {
        console.log(
          `[@meerkat/p2p:visitor] ICE gathering complete — relay gathered: ${relayGathered ? "✅ YES" : "❌ NO"}`,
        );
        if (!relayGathered)
          console.warn(
            `[@meerkat/p2p:visitor] ⚠️ No relay candidates — check TURN server env vars`,
          );
        return;
      }
      const type = candidate.type ?? "?";
      if (type === "relay") relayGathered = true;
      console.log(
        `[@meerkat/p2p:visitor] Gathered: type=${type} proto=${candidate.protocol}${type === "relay" ? " ✅ RELAY" : ""}`,
      );
      if (!this.signaling?.isConnected) return;
      await this.signaling.sendIceCandidate({
        type: "ice-candidate",
        visitorId,
        denId: this.hostDenId,
        candidate: candidate.toJSON(),
        from: "visitor",
      });
    };
    peer.oniceconnectionstatechange = () =>
      console.log(`[@meerkat/p2p:visitor] ICE → ${peer.iceConnectionState}`);
    peer.onconnectionstatechange = () => {
      console.log(
        `[@meerkat/p2p:visitor] Connection → ${peer.connectionState}`,
      );
      if (["disconnected", "failed", "closed"].includes(peer.connectionState))
        this.disconnect();
    };

    // ALL listeners BEFORE subscribe()
    let resolveHostOnline!: () => void;
    const hostOnlinePromise = new Promise<void>((resolve) => {
      resolveHostOnline = resolve;
      setTimeout(() => {
        console.warn(`[@meerkat/p2p:visitor] host-online timeout — proceeding`);
        resolve();
      }, HOST_ONLINE_WAIT_MS);
    });
    this.signaling.onHostOnline((msg) => {
      console.log(`[@meerkat/p2p:visitor] ✅ host-online den=${msg.denId}`);
      resolveHostOnline();
    });

    let resolveResponse!: (msg: JoinResponseSignal) => void;
    let rejectResponse!: (err: Error) => void;
    const responsePromise = new Promise<JoinResponseSignal>((res, rej) => {
      resolveResponse = res;
      rejectResponse = rej;
    });
    const responseTimeout = setTimeout(
      () =>
        rejectResponse(
          new Error(
            `[@meerkat/p2p] No join-response after ${HANDSHAKE_TIMEOUT_MS}ms`,
          ),
        ),
      HANDSHAKE_TIMEOUT_MS,
    );

    this.signaling.onJoinResponse((msg: JoinResponseSignal) => {
      if (msg.visitorId !== visitorId) return;
      console.log(
        `[@meerkat/p2p:visitor] join-response: accepted=${msg.accepted}`,
      );
      clearTimeout(responseTimeout);
      resolveResponse(msg);
    });

    this.signaling.onIceCandidate(async (msg: IceCandidateSignal) => {
      if (msg.from !== "host" || msg.visitorId !== visitorId) return;
      const c = msg.candidate as RTCIceCandidateInit & { type?: string };
      console.log(
        `[@meerkat/p2p:visitor] ICE from host: type=${c.type ?? "?"}${c.type === "relay" ? " ✅ RELAY" : ""}`,
      );
      if (peer.remoteDescription) {
        await peer
          .addIceCandidate(msg.candidate)
          .catch((e) => console.warn(`addIceCandidate error:`, e));
      } else {
        this.pendingCandidates.push(msg.candidate);
      }
    });

    console.log(`[@meerkat/p2p:visitor] Subscribing...`);
    await this.signaling.connect();
    console.log(`[@meerkat/p2p:visitor] ✅ Subscribed`);

    await hostOnlinePromise;

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await this.signaling.sendJoinRequest({
      type: "join-request",
      visitorId,
      denId: this.hostDenId,
      sdpOffer: offer.sdp ?? "",
      denKey: this.denKey,
    });
    console.log(`[@meerkat/p2p:visitor] join-request sent`);

    const response = await responsePromise;
    if (!response.accepted) {
      this._setStatus("offline");
      throw new Error(`[@meerkat/p2p] Rejected: ${response.reason}`);
    }

    await peer.setRemoteDescription({
      type: "answer",
      sdp: response.sdpAnswer,
    });

    console.log(
      `[@meerkat/p2p:visitor] Flushing ${this.pendingCandidates.length} queued ICE candidates`,
    );
    for (const c of this.pendingCandidates)
      await peer.addIceCandidate(c).catch(() => {});
    this.pendingCandidates = [];

    console.log(
      `[@meerkat/p2p:visitor] Handshake complete — waiting for DataChannel.onopen`,
    );
  }

  disconnect(): void {
    this.yjsCleanup?.();
    this.yjsCleanup = null;
    this.peer?.close();
    this.peer = null;
    this.signaling?.disconnect().catch(() => {});
    this.signaling = null;
    this._setStatus("offline");
  }

  private async wireYjsSync(channel: RTCDataChannel): Promise<void> {
    try {
      const { sharedDen } = await openDen(this.hostDenId);
      const awareness = new awarenessProtocol.Awareness(sharedDen.ydoc);
      this.yjsCleanup = wireScopedYjsSync({
        ydoc: sharedDen.ydoc,
        channel,
        awareness,
        canWrite: this.denKey.scope.write,
        role: "visitor",
      });
      console.log(`[@meerkat/p2p:visitor] ✅ Yjs synced`);
      this._setStatus("synced");
    } catch (err) {
      console.error("[@meerkat/p2p:visitor] wireYjsSync failed:", err);
      this.disconnect();
    }
  }

  private _setStatus(next: SyncStatus): void {
    if (next === this._status) return;
    console.log(`[@meerkat/p2p:visitor] Status: ${this._status} → ${next}`);
    this._status = next;
    for (const h of this.statusHandlers) {
      try {
        h(next);
      } catch {}
    }
  }
}
