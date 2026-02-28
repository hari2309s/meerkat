// ─── visitor-connection.ts ───────────────────────────────────────────────────
//
// FIX SUMMARY (2026-03-01):
//
// BUG 1 — Listeners registered AFTER subscribe() [ROOT CAUSE of stuck "Connecting"]
//   Supabase Realtime requires ALL .on("broadcast",...) calls BEFORE .subscribe().
//   The original code called waitForHostOnline() and waitForJoinResponse() after
//   signaling.connect(). Any host-online or join-response that arrived while
//   subscribing was silently dropped forever.
//
//   Fix: Register onHostOnline + onJoinResponse + onIceCandidate BEFORE connect().
//
// BUG 2 — DataChannel created on wrong side
//   Visitor is the offerer (calls createOffer). In WebRTC the offerer MUST call
//   createDataChannel() — it embeds the channel in the SDP. The host (answerer)
//   receives it via ondatachannel. Original code had this backwards: host called
//   createDataChannel(), channel never opened, Yjs never wired, stuck forever.
//
//   Fix: Visitor calls createDataChannel() before createOffer().
//        Host uses ondatachannel (see host-manager.ts).

import * as awarenessProtocol from "y-protocols/awareness";
import { validateKey } from "@meerkat/keys";
import { openDen } from "@meerkat/local-store";
import type { DenKey } from "@meerkat/keys";
import {
  SignalingChannel,
  DEFAULT_ICE_SERVERS,
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

    if (!validateKey(this.denKey)) {
      console.error(`[@meerkat/p2p:visitor] DenKey invalid or expired`);
      throw new Error("[@meerkat/p2p] DenKey is invalid or expired");
    }

    this._setStatus("connecting");

    // 1. Create signaling wrapper (NOT subscribed yet)
    const rawChannel = this.options.createSignalingChannel(
      signalingChannelName(this.hostDenId),
    );
    this.signaling = new SignalingChannel(rawChannel, this.hostDenId);
    console.log(
      `[@meerkat/p2p:visitor] Signaling wrapper created for p2p:den:${this.hostDenId}`,
    );

    // 2. Create RTCPeerConnection
    // iceCandidatePoolSize pre-gathers STUN/TURN candidates before the offer,
    // so relay candidates are available sooner after setLocalDescription.
    const peer = new RTCPeerConnection({
      iceServers: this.options.iceServers ?? DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 2,
    });
    this.peer = peer;

    // 3. FIX BUG 2: Visitor is the offerer — create DataChannel BEFORE createOffer()
    const dataChannel = peer.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    console.log(
      `[@meerkat/p2p:visitor] DataChannel created (visitor is offerer)`,
    );

    dataChannel.onopen = async () => {
      console.log(`[@meerkat/p2p:visitor] DataChannel OPEN`);
      await this.wireYjsSync(dataChannel);
    };
    dataChannel.onclose = () =>
      console.log(`[@meerkat/p2p:visitor] DataChannel closed`);
    dataChannel.onerror = (e) =>
      console.error(`[@meerkat/p2p:visitor] DataChannel error:`, e);

    // 4. ICE + connection state logging
    peer.onicecandidate = async ({ candidate }) => {
      if (!candidate) {
        console.log(`[@meerkat/p2p:visitor] ICE gathering complete`);
        return;
      }
      const type = candidate.type ?? "unknown";
      const proto = candidate.protocol ?? "";
      console.log(
        `[@meerkat/p2p:visitor] New ICE candidate — type=${type} proto=${proto} — sending to host`,
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
      console.log(
        `[@meerkat/p2p:visitor] ICE state → ${peer.iceConnectionState}`,
      );
    peer.onconnectionstatechange = () => {
      console.log(
        `[@meerkat/p2p:visitor] Connection state → ${peer.connectionState}`,
      );
      if (["disconnected", "failed", "closed"].includes(peer.connectionState)) {
        // Full teardown so the signaling channel is unsubscribed and the failed
        // peer connection is released. disconnect() is idempotent.
        this.disconnect();
      }
    };

    // 5. FIX BUG 1: Register ALL broadcast listeners BEFORE calling connect()
    //    Supabase Realtime requires .on() calls before .subscribe().

    // 5a. host-online — resolve immediately if received, or after timeout
    let hostOnlineTimeoutId: ReturnType<typeof setTimeout>;
    let resolveHostOnline!: () => void;
    const hostOnlinePromise = new Promise<void>((resolve) => {
      resolveHostOnline = () => {
        clearTimeout(hostOnlineTimeoutId);
        resolve();
      };
      hostOnlineTimeoutId = setTimeout(() => {
        console.warn(
          `[@meerkat/p2p:visitor] host-online not received within ${HOST_ONLINE_WAIT_MS}ms — proceeding anyway`,
        );
        resolve();
      }, HOST_ONLINE_WAIT_MS);
    });
    this.signaling.onHostOnline((msg) => {
      console.log(
        `[@meerkat/p2p:visitor] ✅ host-online received from den=${msg.denId}`,
      );
      resolveHostOnline();
    });

    // 5b. join-response
    let resolveResponse!: (msg: JoinResponseSignal) => void;
    let rejectResponse!: (err: Error) => void;
    const responsePromise = new Promise<JoinResponseSignal>((res, rej) => {
      resolveResponse = res;
      rejectResponse = rej;
    });
    const responseTimeout = setTimeout(() => {
      rejectResponse(
        new Error(
          `[@meerkat/p2p] No join-response after ${HANDSHAKE_TIMEOUT_MS}ms — ` +
            `check host console for handleJoinRequest logs`,
        ),
      );
    }, HANDSHAKE_TIMEOUT_MS);

    this.signaling.onJoinResponse((msg: JoinResponseSignal) => {
      console.log(
        `[@meerkat/p2p:visitor] join-response received: accepted=${msg.accepted} for visitorId=${msg.visitorId}`,
      );
      if (msg.visitorId !== visitorId) {
        console.warn(
          `[@meerkat/p2p:visitor] visitorId mismatch — expected ${visitorId}, got ${msg.visitorId}`,
        );
        return;
      }
      clearTimeout(responseTimeout);
      resolveResponse(msg);
    });

    // 5c. ICE from host
    this.signaling.onIceCandidate(async (msg: IceCandidateSignal) => {
      if (msg.from !== "host" || msg.visitorId !== visitorId) return;
      console.log(`[@meerkat/p2p:visitor] ICE candidate received from host`);
      if (peer.remoteDescription) {
        await peer
          .addIceCandidate(msg.candidate)
          .catch((e) =>
            console.warn(`[@meerkat/p2p:visitor] addIceCandidate error:`, e),
          );
      } else {
        console.log(
          `[@meerkat/p2p:visitor] Queuing ICE candidate (no remote desc yet)`,
        );
        this.pendingCandidates.push(msg.candidate);
      }
    });

    // 6. NOW subscribe
    console.log(`[@meerkat/p2p:visitor] Subscribing to signaling channel...`);
    await this.signaling.connect();
    console.log(`[@meerkat/p2p:visitor] ✅ Signaling channel SUBSCRIBED`);

    // 7. Wait for host-online
    console.log(`[@meerkat/p2p:visitor] Waiting for host-online...`);
    await hostOnlinePromise;

    // 8. Send join-request
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    console.log(`[@meerkat/p2p:visitor] Offer created, sending join-request`);

    await this.signaling.sendJoinRequest({
      type: "join-request",
      visitorId,
      denId: this.hostDenId,
      sdpOffer: offer.sdp ?? "",
      denKey: this.denKey,
    });
    console.log(
      `[@meerkat/p2p:visitor] join-request sent — awaiting response...`,
    );

    // 9. Await response
    const response = await responsePromise;
    if (!response.accepted) {
      this._setStatus("offline");
      throw new Error(
        `[@meerkat/p2p] Rejected: ${response.reason ?? "unknown"}`,
      );
    }

    // 10. Set remote description
    console.log(`[@meerkat/p2p:visitor] Setting remote description`);
    await peer.setRemoteDescription({
      type: "answer",
      sdp: response.sdpAnswer,
    });

    // 11. Flush queued ICE
    console.log(
      `[@meerkat/p2p:visitor] Flushing ${this.pendingCandidates.length} queued ICE candidates`,
    );
    for (const c of this.pendingCandidates) {
      await peer
        .addIceCandidate(c)
        .catch((e) =>
          console.warn(`[@meerkat/p2p:visitor] queued ICE failed:`, e),
        );
    }
    this.pendingCandidates = [];

    console.log(
      `[@meerkat/p2p:visitor] Handshake complete — waiting for DataChannel.onopen`,
    );
    // → dataChannel.onopen → wireYjsSync → _setStatus("synced")
  }

  disconnect(): void {
    console.log(`[@meerkat/p2p:visitor] disconnect()`);
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
      console.log(
        `[@meerkat/p2p:visitor] Opening den ${this.hostDenId} for Yjs sync`,
      );
      const { sharedDen } = await openDen(this.hostDenId);
      const awareness = new awarenessProtocol.Awareness(sharedDen.ydoc);
      this.yjsCleanup = wireScopedYjsSync({
        ydoc: sharedDen.ydoc,
        channel,
        awareness,
        canWrite: this.denKey.scope.write,
        role: "visitor",
      });
      console.log(`[@meerkat/p2p:visitor] ✅ Yjs sync wired → status "synced"`);
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
      } catch (e) {
        console.error("[@meerkat/p2p:visitor] status handler threw:", e);
      }
    }
  }
}
