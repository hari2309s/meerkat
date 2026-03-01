// ─── host-manager.ts ─────────────────────────────────────────────────────────
//
// FIX (2026-03-01):
//   Host is the ANSWERER — it must NOT call createDataChannel().
//   The visitor (offerer) creates the channel; host receives it via ondatachannel.
//   Original code had host calling createDataChannel() which caused SDP mismatch
//   and the channel never opened.

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
const PRESENCE_HEARTBEAT_MS = 15_000;
const PRESENCE_CLEANUP_MS = 30_000; // Clean up stale entries every 30 seconds
const PRESENCE_TTL_MS = 60_000; // Remove entries older than 60 seconds

interface ActiveSession {
  session: VisitorSession;
  cleanup: () => void;
}

export class HostManager {
  private readonly denId: string;
  private readonly options: P2PManagerOptions;

  private sessions = new Map<string, ActiveSession>();
  private signaling: SignalingChannel | null = null;
  private statusHandlers = new Set<(status: SyncStatus) => void>();
  private _status: SyncStatus = "offline";
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private hostOnlineHeartbeat: ReturnType<typeof setInterval> | null = null;
  private presenceCleanup: ReturnType<typeof setInterval> | null = null;
  private static readonly HOST_ONLINE_INTERVAL_MS = 5_000;
  private _startPromise: Promise<() => void> | null = null;

  constructor(denId: string, options: P2PManagerOptions) {
    this.denId = denId;
    this.options = options;
  }

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

  async start(hostPublicKey: string = ""): Promise<() => void> {
    if (this._startPromise) return this._startPromise;

    this._startPromise = (async () => {
      try {
        console.log(`[@meerkat/p2p:host] start() — den=${this.denId}`);

        const rawChannel = this.options.createSignalingChannel(
          signalingChannelName(this.denId),
        );
        this.signaling = new SignalingChannel(rawChannel, this.denId);

        // Wire listeners BEFORE subscribe
        this.signaling.onJoinRequest((msg) => this.handleJoinRequest(msg));
        this.signaling.onIceCandidate((msg) => this.handleIceCandidate(msg));

        console.log(`[@meerkat/p2p:host] Subscribing to signaling channel...`);
        await this.signaling.connect();
        console.log(`[@meerkat/p2p:host] ✅ Signaling channel connected`);

        await this.signaling.broadcastHostOnline({
          denId: this.denId,
          hostPublicKey,
        });
        console.log(`[@meerkat/p2p:host] ✅ host-online broadcast sent`);

        this.hostOnlineHeartbeat = setInterval(() => {
          this.signaling
            ?.broadcastHostOnline({ denId: this.denId, hostPublicKey })
            .catch(() => {});
        }, HostManager.HOST_ONLINE_INTERVAL_MS);

        // Start periodic cleanup of stale presence entries
        this.presenceCleanup = setInterval(() => {
          this.cleanupStalePresence().catch(() => {});
        }, PRESENCE_CLEANUP_MS);

        this._setStatus("synced");
        console.log(`[@meerkat/p2p:host] ✅ Hosting started — status=synced`);

        return () => this.stop();
      } catch (err) {
        this._startPromise = null;
        throw err;
      }
    })();

    return this._startPromise;
  }

  async stop(): Promise<void> {
    console.log(`[@meerkat/p2p:host] stop() — den=${this.denId}`);
    if (this.hostOnlineHeartbeat) {
      clearInterval(this.hostOnlineHeartbeat);
      this.hostOnlineHeartbeat = null;
    }
    if (this.presenceCleanup) {
      clearInterval(this.presenceCleanup);
      this.presenceCleanup = null;
    }
    try {
      await this.signaling?.broadcastHostOffline();
    } catch {
      /* best-effort */
    }
    for (const [visitorId] of this.sessions)
      await this.disconnectVisitor(visitorId);
    await this.signaling?.disconnect();
    this.signaling = null;
    this._startPromise = null;
    this._setStatus("offline");
  }

  async disconnectVisitor(visitorId: string): Promise<void> {
    const active = this.sessions.get(visitorId);
    if (!active) return;
    active.cleanup();
    this.sessions.delete(visitorId);
    try {
      const { sharedDen } = await openDen(this.denId);
      sharedDen.ydoc.transact(() => {
        sharedDen.presence.delete(visitorId);
      });
    } catch {
      /* non-fatal */
    }
    this._updateStatusFromSessions();
  }

  private async handleJoinRequest(msg: JoinRequestSignal): Promise<void> {
    const { visitorId, denKey, sdpOffer } = msg;
    console.log(
      `[@meerkat/p2p:host] join-request received from visitorId=${visitorId}`,
    );

    if (!validateKey(denKey) || denKey.denId !== this.denId) {
      console.warn(
        `[@meerkat/p2p:host] DenKey invalid or wrong den — rejecting`,
      );
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

    const peer = new RTCPeerConnection({
      iceServers: this.options.iceServers ?? DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 2,
    });

    // FIX: Host is ANSWERER — use ondatachannel, NOT createDataChannel()
    // The visitor (offerer) creates the channel; it arrives here via this event.
    let yjsCleanup: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval>;

    peer.ondatachannel = (event) => {
      console.log(
        `[@meerkat/p2p:host] ondatachannel fired — label=${event.channel.label}`,
      );
      if (event.channel.label !== DATA_CHANNEL_LABEL) return;
      const dc = event.channel;

      dc.onopen = async () => {
        console.log(
          `[@meerkat/p2p:host] DataChannel OPEN for visitorId=${visitorId}`,
        );
        try {
          const { sharedDen } = await openDen(this.denId);
          const awareness = new awarenessProtocol.Awareness(sharedDen.ydoc);

          yjsCleanup = wireScopedYjsSync({
            ydoc: sharedDen.ydoc,
            channel: dc,
            awareness,
            canWrite: denKey.scope.write,
            role: "host",
          });

          await this.writePresence(visitorId, denKey);

          heartbeat = setInterval(() => {
            this.touchPresence(visitorId).catch(() => {});
          }, PRESENCE_HEARTBEAT_MS);

          // Update cleanup
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
            `[@meerkat/p2p:host] ✅ Yjs sync wired for visitorId=${visitorId}`,
          );
        } catch (err) {
          console.error(`[@meerkat/p2p:host] wireYjsSync failed:`, err);
          await this.disconnectVisitor(visitorId);
        }
      };

      dc.onclose = () =>
        console.log(
          `[@meerkat/p2p:host] DataChannel closed for visitorId=${visitorId}`,
        );
      dc.onerror = (e) =>
        console.error(`[@meerkat/p2p:host] DataChannel error:`, e);
    };

    // ICE relay
    peer.onicecandidate = async ({ candidate }) => {
      if (!candidate) {
        console.log(
          `[@meerkat/p2p:host] ICE gathering complete for ${visitorId}`,
        );
        return;
      }
      const type = candidate.type ?? "unknown";
      const proto = candidate.protocol ?? "";
      console.log(
        `[@meerkat/p2p:host] Sending ICE candidate type=${type} proto=${proto} to visitorId=${visitorId}`,
      );
      await this.signaling?.sendIceCandidate({
        type: "ice-candidate",
        visitorId,
        denId: this.denId,
        candidate: candidate.toJSON(),
        from: "host",
      });
    };

    peer.oniceconnectionstatechange = () =>
      console.log(
        `[@meerkat/p2p:host] ICE state for ${visitorId} → ${peer.iceConnectionState}`,
      );
    peer.onconnectionstatechange = () => {
      console.log(
        `[@meerkat/p2p:host] Connection state for ${visitorId} → ${peer.connectionState}`,
      );
      if (["disconnected", "failed", "closed"].includes(peer.connectionState)) {
        this.disconnectVisitor(visitorId);
      }
    };

    console.log(
      `[@meerkat/p2p:host] Setting remote description (visitor offer)`,
    );
    await peer.setRemoteDescription({ type: "offer", sdp: sdpOffer });

    // Flush queued ICE
    const queued = this.pendingCandidates.get(visitorId) ?? [];
    console.log(
      `[@meerkat/p2p:host] Flushing ${queued.length} queued ICE candidates`,
    );
    for (const c of queued) await peer.addIceCandidate(c).catch(() => {});
    this.pendingCandidates.delete(visitorId);

    console.log(`[@meerkat/p2p:host] Creating SDP answer`);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    await this.signaling?.sendJoinResponse({
      type: "join-response",
      visitorId,
      denId: this.denId,
      sdpAnswer: answer.sdp ?? "",
      accepted: true,
    });
    console.log(
      `[@meerkat/p2p:host] ✅ join-response sent to visitorId=${visitorId}`,
    );

    // Store session immediately so ICE candidates can be applied
    this.sessions.set(visitorId, {
      session: {
        visitorId,
        scope: denKey.scope,
        connectedAt: new Date().toISOString(),
        peer,
        activeNamespaces: denKey.scope.namespaces,
      },
      cleanup: () => {
        yjsCleanup?.();
        if (heartbeat) clearInterval(heartbeat);
        peer.close();
      },
    });

    // Second flush: visitor ICE candidates that arrived during createAnswer /
    // setLocalDescription / sendJoinResponse awaits were re-queued (session
    // didn't exist yet). Now that the session is stored, drain them.
    const late = this.pendingCandidates.get(visitorId) ?? [];
    if (late.length > 0) {
      console.log(
        `[@meerkat/p2p:host] Flushing ${late.length} late-queued ICE candidates for ${visitorId}`,
      );
      for (const c of late) await peer.addIceCandidate(c).catch(() => {});
      this.pendingCandidates.delete(visitorId);
    }
  }

  private handleIceCandidate(msg: IceCandidateSignal): void {
    if (msg.from !== "visitor") return;
    const { visitorId, candidate } = msg;
    console.log(
      `[@meerkat/p2p:host] ICE candidate from visitorId=${visitorId}`,
    );
    const active = this.sessions.get(visitorId);
    if (active?.session.peer.remoteDescription) {
      active.session.peer
        .addIceCandidate(candidate)
        .catch((e) =>
          console.warn(`[@meerkat/p2p:host] addIceCandidate failed:`, e),
        );
    } else {
      const existing = this.pendingCandidates.get(visitorId) ?? [];
      existing.push(candidate);
      this.pendingCandidates.set(visitorId, existing);
    }
  }

  private async writePresence(
    visitorId: string,
    denKey: DenKey,
  ): Promise<void> {
    try {
      const { sharedDen } = await openDen(this.denId);
      const presence: PresenceInfo = {
        visitorId,
        displayName: "Visitor",
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
      /* non-fatal */
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
      /* non-fatal */
    }
  }

  private async cleanupStalePresence(): Promise<void> {
    try {
      const { sharedDen } = await openDen(this.denId);
      const now = Date.now();
      const staleEntries: string[] = [];
      
      // Find stale entries
      for (const [visitorId, presence] of sharedDen.presence.entries()) {
        if (now - presence.lastSeenAt > PRESENCE_TTL_MS) {
          staleEntries.push(visitorId);
        }
      }
      
      // Remove stale entries
      if (staleEntries.length > 0) {
        console.log(`[@meerkat/p2p:host] Cleaning up ${staleEntries.length} stale presence entries:`, staleEntries);
        sharedDen.ydoc.transact(() => {
          for (const visitorId of staleEntries) {
            sharedDen.presence.delete(visitorId);
          }
        });
      }
    } catch (err) {
      console.error("[@meerkat/p2p:host] Error cleaning up stale presence:", err);
    }
  }

  private _updateStatusFromSessions(): void {
    const next: SyncStatus = this.sessions.size > 0 ? "hosting" : "synced";
    this._setStatus(next);
  }

  private _setStatus(next: SyncStatus): void {
    if (next === this._status) return;
    console.log(`[@meerkat/p2p:host] Status: ${this._status} → ${next}`);
    this._status = next;
    for (const h of this.statusHandlers) {
      try {
        h(next);
      } catch (e) {
        console.error("[@meerkat/p2p:host] status handler threw:", e);
      }
    }
  }
}
