// ─── hooks.ts ────────────────────────────────────────────────────────────────
//
// React hooks for @meerkat/p2p.
//
// useHostStatus(denId)       — host: are you reachable? how many visitors?
// useVisitorPresence(denId)  — host: who's in the den right now?
// useJoinDen()               — visitor: connect to a host den with a DenKey

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { validateKey } from "@meerkat/keys";
import type { DenKey } from "@meerkat/keys";
import { getP2PManager } from "./lib/p2p-manager";
import { VisitorConnection } from "./lib/visitor-connection";
import type {
  SyncStatus,
  VisitorSession,
  UseHostStatusReturn,
  UseVisitorPresenceReturn,
  UseJoinDenReturn,
  P2PManagerOptions,
} from "./types";

// ─── useHostStatus ────────────────────────────────────────────────────────────

/**
 * Exposes the host's availability state for a den.
 *
 * Tracks whether the signaling channel is active and how many visitors are
 * connected. Does NOT start hosting — that is managed by @meerkat/crdt's
 * DenProvider via the P2PAdapter.
 *
 * @example
 * ```tsx
 * const { isOnline, visitorCount, syncStatus } = useHostStatus(denId)
 *
 * <span>
 *   {isOnline ? `Online · ${visitorCount} visitor(s)` : 'Offline'}
 * </span>
 * ```
 */
export function useHostStatus(denId: string): UseHostStatusReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [visitorCount, setVisitorCount] = useState(0);

  // Poll visitor count — presence changes aren't surfaced as status events
  useEffect(() => {
    let manager: ReturnType<typeof getP2PManager> | null = null;
    try {
      manager = getP2PManager();
    } catch {
      return;
    }

    // Subscribe to status changes
    const unsub = manager.onStatusChange(denId, (status) => {
      setSyncStatus(status);
      setVisitorCount(manager!.getVisitorSessions(denId).length);
    });

    // Sync initial values
    setSyncStatus(manager.getStatus(denId));
    setVisitorCount(manager.getVisitorSessions(denId).length);

    return unsub;
  }, [denId]);

  const startHosting = useCallback(() => {
    try {
      getP2PManager().hostDen(denId);
    } catch (err) {
      console.warn("[@meerkat/p2p] useHostStatus.startHosting:", err);
    }
  }, [denId]);

  const stopHosting = useCallback(() => {
    try {
      getP2PManager().getHostManager(denId)?.stop();
    } catch (err) {
      console.warn("[@meerkat/p2p] useHostStatus.stopHosting:", err);
    }
  }, [denId]);

  return {
    isOnline: syncStatus !== "offline",
    visitorCount,
    syncStatus,
    startHosting,
    stopHosting,
  };
}

// ─── useVisitorPresence ───────────────────────────────────────────────────────

/**
 * Returns live visitor sessions for a den on the host side.
 *
 * Polls every second — visitor sessions are not reactive by themselves,
 * but the underlying HostManager updates on connect/disconnect.
 *
 * For a purely reactive version, @meerkat/local-store's usePresence() hook
 * reads directly from shared.ydoc's presence namespace (updated by HostManager).
 *
 * @example
 * ```tsx
 * const { visitors, disconnectVisitor } = useVisitorPresence(denId)
 *
 * {visitors.map((v) => (
 *   <VisitorCard
 *     key={v.visitorId}
 *     visitor={v}
 *     onKick={() => disconnectVisitor(v.visitorId)}
 *   />
 * ))}
 * ```
 */
export function useVisitorPresence(denId: string): UseVisitorPresenceReturn {
  const [visitors, setVisitors] = useState<VisitorSession[]>([]);

  useEffect(() => {
    let manager: ReturnType<typeof getP2PManager> | null = null;
    try {
      manager = getP2PManager();
    } catch {
      return;
    }

    // Initial read
    setVisitors(manager.getVisitorSessions(denId));

    // Update on status change (connecting/hosting transitions mean sessions changed)
    const unsub = manager.onStatusChange(denId, () => {
      setVisitors(manager!.getVisitorSessions(denId));
    });

    return unsub;
  }, [denId]);

  const disconnectVisitor = useCallback(
    (visitorId: string) => {
      try {
        getP2PManager()
          .disconnectVisitor(denId, visitorId)
          .catch((err) =>
            console.warn("[@meerkat/p2p] disconnectVisitor error:", err),
          );
      } catch (err) {
        console.warn("[@meerkat/p2p] useVisitorPresence:", err);
      }
    },
    [denId],
  );

  return { visitors, disconnectVisitor };
}

// ─── useJoinDen ──────────────────────────────────────────────────────────────

/**
 * Visitor-side hook to connect to a host den using a redeemed DenKey.
 *
 * Manages the full WebRTC connection lifecycle including cleanup on unmount.
 *
 * @example
 * ```tsx
 * const { join, status, error, disconnect } = useJoinDen(options)
 *
 * // On button press:
 * await join(redeemedDenKey)
 *
 * // Status: 'offline' | 'connecting' | 'synced'
 * // synced = Yjs is live-syncing with the host
 * ```
 */
export function useJoinDen(options: P2PManagerOptions): UseJoinDenReturn {
  const [status, setStatus] = useState<SyncStatus>("offline");
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the active connection so we can clean up on unmount
  const connectionRef = useRef<VisitorConnection | null>(null);

  // Generate a stable ephemeral visitor ID for the session lifetime
  const visitorIdRef = useRef<string>(generateVisitorId());

  // Clean up on unmount
  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };
  }, []);

  const join = useCallback(
    async (denKey: DenKey) => {
      // Disconnect any existing connection first
      connectionRef.current?.disconnect();
      connectionRef.current = null;

      setError(null);

      if (!validateKey(denKey)) {
        setError("Key is invalid or expired");
        setStatus("offline");
        return;
      }

      const connection = new VisitorConnection(denKey, denKey.denId, options);

      // Mirror connection status into React state
      connection.onStatusChange((s) => setStatus(s));
      connectionRef.current = connection;

      try {
        await connection.connect(visitorIdRef.current);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        setError(msg);
        setStatus("offline");
      }
    },
    [options],
  );

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setStatus("offline");
    setError(null);
  }, []);

  return { join, status, error, disconnect };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateVisitorId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
