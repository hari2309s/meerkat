// ─── host-manager.ts ─────────────────────────────────────────────────────────
//
// Host-side P2P session management.
//
// Responsibilities:
//   1. Advertise on the signaling channel ("host-online")
//   2. Receive join-request signals from visitors
//   3. Validate the visitor's DenKey (expiry, scope integrity)
//   4. Complete the WebRTC handshake (SDP offer/answer, ICE)
//   5. Open a data channel and wire scoped Yjs sync
//   6. Write visitor presence into shared.ydoc presence namespace
//   7. Clean up on disconnect or revocation
//
// Scope enforcement:
//   The host only passes shared.ydoc (never private.ydoc) to wireScopedYjsSync.
//   Yjs document structuring (namespaces as named maps/arrays) means Yjs updates
//   are doc-level, but since private.ydoc is never shared, the visitor can never
//   read private content regardless of their key. Within shared.ydoc, namespace
//   key encryption (from @meerkat/crypto) ensures that even if the visitor sees
//   the full doc, they can only decrypt entries whose namespace key they hold.

import * as awarenessProtocol from "y-protocols/awareness";
import { validateKey } from "@meerkat/keys";
import { openDen } from "@meerkat/local-store";
import type { DenKey } from "@meerkat/keys";
import type { PresenceInfo } from "@meerkat/local-store";
import {
  SignalingChannel,
  DEFAULT_ICE_SERVERS,
  signalingChannelName,
} from "./signaling";
import { wireScopedYjsSync } from "./yjs-sync";
import type {
  VisitorSession,
  SyncStatus,
  P2PManagerOptions,
  JoinRequestSignal,
  IceCandidateSignal,
} from "../types";

const DATA_CHANNEL_LABEL = "yjs-sync";
// Presence heartbeat — keeps the visitor's entry fresh in shared.ydoc
const PRESENCE_HEARTBEAT_MS = 15_000;

// ─── HostManager ─────────────────────────────────────────────────────────────

/**
 * Manages all active visitor sessions for a single den on the host side.
 *
 * Lifecycle:
 *   const host = new HostManager(denId, options)
 *   const stop = await host.start()   // start advertising
 *   stop()                            // stop advertising + disconnect all visitors
 */
export class HostManager {
  private readonly denId: string;
  private readonly options: P2PManagerOptions;

  // Active visitor connections — keyed by visitorId
  private sessions = new Map<string, ActiveSession>();

  // Signaling channel (one per host, created on start())
  private signaling: SignalingChannel | null = null;

  // Status listeners
  private statusHandlers = new Set<(status: SyncStatus) => void>();
  private _status: SyncStatus = "offline";

  // ICE candidates queued before remote description is set
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

  // Heartbeat so late-joining visitors receive host-online (pub/sub typically doesn't replay)
  private hostOnlineHeartbeat: ReturnType<typeof setInterval> | null = null;
  private static readonly HOST_ONLINE_INTERVAL_MS = 5_000;

  private _startPromise: Promise<() => void> | null = null;

  constructor(denId: string, options: P2PManagerOptions) {
    this.denId = denId;
    this.options = options;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get status(): SyncStatus {
    return this._status;
  }

  get visitorSessions(): VisitorSession[] {
    return Array.from(this.sessions.values()).map((s) => s.session);
  }

  onStatusChange(handler: (status: SyncStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * Start advertising as a host on the signaling channel.
   * Returns a cleanup/stop function.
   *
   * Idempotent: safe to call multiple times. Concurrent calls will
   * wait for the first one to complete.
   */
  async start(hostPublicKey: string = ""): Promise<() => void> {
    if (this._startPromise) {
      return this._startPromise;
    }

    this._startPromise = (async () => {
      try {
        console.log(
          `[@meerkat/p2p] HostManager.start() called for den ${this.denId}`,
        );

        const channel = this.options.createSignalingChannel(
          signalingChannelName(this.denId),
        );
        console.log(
          `[@meerkat/p2p] Signaling channel created for den ${this.denId}`,
        );

        this.signaling = new SignalingChannel(channel, this.denId);

        // Wire listeners BEFORE subscribing (Supabase Realtime requirement)
        this.signaling.onJoinRequest((msg) => this.handleJoinRequest(msg));
        this.signaling.onIceCandidate((msg) => this.handleIceCandidate(msg));

        console.log(
          `[@meerkat/p2p] Connecting to signaling channel for den ${this.denId}...`,
        );
        await this.signaling.connect();
        console.log(
          `[@meerkat/p2p] Signaling channel connected for den ${this.denId}`,
        );

        // Advertise presence
        console.log(
          `[@meerkat/p2p] Broadcasting host-online for den ${this.denId}...`,
        );
        await this.signaling.broadcastHostOnline({
          denId: this.denId,
          hostPublicKey,
        });
        console.log(
          `[@meerkat/p2p] Host-online broadcast complete for den ${this.denId}`,
        );

        // Heartbeat so late-joining visitors get host-online (no message replay)
        this.hostOnlineHeartbeat = setInterval(() => {
          this.signaling
            ?.broadcastHostOnline({
              denId: this.denId,
              hostPublicKey,
            })
            .catch(() => {});
        }, HostManager.HOST_ONLINE_INTERVAL_MS);

        this._setStatus("synced");
        console.log(
          `[@meerkat/p2p] Status set to 'synced' for den ${this.denId}`,
        );

        return () => this.stop();
      } catch (err) {
        // Clear promise on failure so we can retry later
        this._startPromise = null;
        throw err;
      }
    })();

    return this._startPromise;
  }

  /**
   * Stop hosting: broadcast offline, close all peer connections, clean up.
   */
  async stop(): Promise<void> {
    if (this.hostOnlineHeartbeat) {
      clearInterval(this.hostOnlineHeartbeat);
      this.hostOnlineHeartbeat = null;
    }
    // Broadcast going offline so visitors can update their UI immediately
    try {
      await this.signaling?.broadcastHostOffline();
    } catch {
      // Best-effort — we're shutting down regardless
    }

    // Disconnect all visitors
    for (const [visitorId] of this.sessions) {
      await this.disconnectVisitor(visitorId);
    }

    await this.signaling?.disconnect();
    this.signaling = null;

    this._startPromise = null;
    this._setStatus("offline");
  }

  /**
   * Forcibly disconnect a specific visitor. Removes their presence entry.
   */
  async disconnectVisitor(visitorId: string): Promise<void> {
    const active = this.sessions.get(visitorId);
    if (!active) return;

    active.cleanup();
    this.sessions.delete(visitorId);

    // Remove from presence namespace in shared.ydoc
    try {
      const { sharedDen } = await openDen(this.denId);
      sharedDen.ydoc.transact(() => {
        sharedDen.presence.delete(visitorId);
      });
    } catch {
      // Non-fatal — den may already be closing
    }

    this._updateStatusFromSessions();
  }

  // ── Private: handshake ────────────────────────────────────────────────────

  private async handleJoinRequest(msg: JoinRequestSignal): Promise<void> {
    const { visitorId, denKey, sdpOffer } = msg;

    // 1. Validate the DenKey
    if (!validateKey(denKey) || denKey.denId !== this.denId) {
      await this.signaling?.sendJoinResponse({
        type: "join-response",
        visitorId,
        denId: this.denId,
        sdpAnswer: "",
        accepted: false,
        reason: "Invalid or expired key",
      });
      return;
    }

    // 2. Create a peer connection
    const peer = new RTCPeerConnection({
      iceServers: this.options.iceServers ?? DEFAULT_ICE_SERVERS,
    });

    // 3. FIX: The host is the ANSWERER — it must NOT call createDataChannel().
    // The visitor (offerer) creates the DataChannel, which embeds it in the SDP
    // offer. The host receives it via ondatachannel after the connection is
    // established. Calling createDataChannel() here was the root cause of the
    // visitor being permanently stuck at "Connecting" — the host's answer SDP
    // contained a mismatched data channel negotiation that the visitor's peer
    // connection rejected, so the channel never opened.
    let yjsCleanup: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval>;

    peer.ondatachannel = async (event) => {
      if (event.channel.label !== DATA_CHANNEL_LABEL) return;
      const dataChannel = event.channel;

      dataChannel.onopen = async () => {
        try {
          const { sharedDen } = await openDen(this.denId);
          const awareness = new awarenessProtocol.Awareness(sharedDen.ydoc);

          yjsCleanup = wireScopedYjsSync({
            ydoc: sharedDen.ydoc,
            channel: dataChannel,
            awareness,
            canWrite: denKey.scope.write,
            role: "host",
          });

          // Write visitor into presence namespace
          await this.writePresence(visitorId, denKey);

          // Heartbeat to keep presence fresh
          heartbeat = setInterval(async () => {
            await this.touchPresence(visitorId);
          }, PRESENCE_HEARTBEAT_MS);

          // Update cleanup to include Yjs teardown
          this.sessions.set(visitorId, {
            session: this.sessions.get(visitorId)!.session,
            cleanup: () => {
              yjsCleanup?.();
              clearInterval(heartbeat);
              peer.close();
            },
          });

          this._updateStatusFromSessions();
          console.log(
            `[@meerkat/p2p] Visitor ${visitorId} Yjs sync wired for den ${this.denId}`,
          );
        } catch (err) {
          console.error(
            `[@meerkat/p2p] Failed to wire Yjs sync for visitor ${visitorId}:`,
            err,
          );
          await this.disconnectVisitor(visitorId);
        }
      };
    };

    // 4. ICE candidate relay
    peer.onicecandidate = async ({ candidate }) => {
      if (!candidate) return;
      await this.signaling?.sendIceCandidate({
        type: "ice-candidate",
        visitorId,
        denId: this.denId,
        candidate: candidate.toJSON(),
        from: "host",
      });
    };

    // 5. Handle peer disconnection
    peer.onconnectionstatechange = () => {
      if (
        peer.connectionState === "disconnected" ||
        peer.connectionState === "failed" ||
        peer.connectionState === "closed"
      ) {
        this.disconnectVisitor(visitorId);
      }
    };

    // 6. Set remote description (the visitor's offer)
    await peer.setRemoteDescription({ type: "offer", sdp: sdpOffer });

    // 7. Apply any ICE candidates that arrived before the remote description
    const queued = this.pendingCandidates.get(visitorId) ?? [];
    for (const c of queued) {
      await peer.addIceCandidate(c).catch(() => {});
    }
    this.pendingCandidates.delete(visitorId);

    // 8. Create and send answer
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    await this.signaling?.sendJoinResponse({
      type: "join-response",
      visitorId,
      denId: this.denId,
      sdpAnswer: answer.sdp ?? "",
      accepted: true,
    });

    // 9. Store the session immediately so ICE candidates can be applied
    const session: VisitorSession = {
      visitorId,
      scope: denKey.scope,
      connectedAt: new Date().toISOString(),
      peer,
      activeNamespaces: denKey.scope.namespaces,
    };

    this.sessions.set(visitorId, {
      session,
      cleanup: () => {
        yjsCleanup?.();
        clearInterval(heartbeat);
        peer.close();
      },
    });

    // Status will update to "hosting" once the data channel opens and Yjs wires up
    // (ondatachannel → onopen → _updateStatusFromSessions)
  }

  private handleIceCandidate(msg: IceCandidateSignal): void {
    if (msg.from !== "visitor") return;
    const { visitorId, candidate } = msg;

    const active = this.sessions.get(visitorId);
    if (active?.session.peer.remoteDescription) {
      active.session.peer.addIceCandidate(candidate).catch(() => {});
    } else {
      // Queue until remote description is set
      const existing = this.pendingCandidates.get(visitorId) ?? [];
      existing.push(candidate);
      this.pendingCandidates.set(visitorId, existing);
    }
  }

  // ── Private: presence ─────────────────────────────────────────────────────

  private async writePresence(
    visitorId: string,
    denKey: DenKey,
  ): Promise<void> {
    try {
      const { sharedDen } = await openDen(this.denId);
      const presence: PresenceInfo = {
        visitorId,
        displayName: `Visitor`,
        scopes: [
          ...(denKey.scope.read ? ["read"] : []),
          ...(denKey.scope.write ? ["write"] : []),
          ...(denKey.scope.offline ? ["offline"] : []),
        ],
        connectedAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      sharedDen.ydoc.transact(() => {
        sharedDen.presence.set(visitorId, presence);
      });
    } catch {
      // Non-fatal
    }
  }

  private async touchPresence(visitorId: string): Promise<void> {
    try {
      const { sharedDen } = await openDen(this.denId);
      const existing = sharedDen.presence.get(visitorId);
      if (existing) {
        sharedDen.ydoc.transact(() => {
          sharedDen.presence.set(visitorId, {
            ...existing,
            lastSeenAt: Date.now(),
          });
        });
      }
    } catch {
      // Non-fatal
    }
  }

  // ── Private: status ───────────────────────────────────────────────────────

  private _updateStatusFromSessions(): void {
    const next: SyncStatus = this.sessions.size > 0 ? "hosting" : "synced";
    this._setStatus(next);
  }

  private _setStatus(next: SyncStatus): void {
    if (next === this._status) return;
    this._status = next;
    for (const handler of this.statusHandlers) {
      try {
        handler(next);
      } catch (err) {
        console.error("[@meerkat/p2p] Status handler threw:", err);
      }
    }
  }
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface ActiveSession {
  session: VisitorSession;
  cleanup: () => void;
}
