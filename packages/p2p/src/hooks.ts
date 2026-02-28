// ─── hooks.ts ────────────────────────────────────────────────────────────────
//
// React hooks for @meerkat/p2p.
//
// FIX (2026-03-01): Added RETRY_DELAY_MS to useJoinDen.
// When a connection fails, visitorStatus → "offline" triggers the auto-join
// effect in den-page-client-enhanced.tsx immediately. But the old Supabase
// channel for the same name is still being torn down (WebSocket close is async).
// Attempting to create a new channel with the same name while the old one is
// closing causes "WebSocket closed before connection established".
//
// Fix: track whether a retry is in-flight and debounce reconnect by 2s.

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

// How long to wait after a failed connection before retrying.
// Supabase needs time to fully close the old WebSocket for the channel name.
const RETRY_DELAY_MS = 2_000;

// ─── useHostStatus ────────────────────────────────────────────────────────────

export function useHostStatus(denId: string): UseHostStatusReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [visitorCount, setVisitorCount] = useState(0);

  useEffect(() => {
    let manager: ReturnType<typeof getP2PManager> | null = null;
    try {
      manager = getP2PManager();
    } catch {
      return;
    }

    const unsub = manager.onStatusChange(denId, (status) => {
      setSyncStatus(status);
      setVisitorCount(manager!.getVisitorSessions(denId).length);
    });

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

export function useVisitorPresence(denId: string): UseVisitorPresenceReturn {
  const [visitors, setVisitors] = useState<VisitorSession[]>([]);

  useEffect(() => {
    let manager: ReturnType<typeof getP2PManager> | null = null;
    try {
      manager = getP2PManager();
    } catch {
      return;
    }

    setVisitors(manager.getVisitorSessions(denId));

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

export function useJoinDen(options: P2PManagerOptions): UseJoinDenReturn {
  const [status, setStatus] = useState<SyncStatus>("offline");
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<VisitorConnection | null>(null);
  const visitorIdRef = useRef<string>(generateVisitorId());

  // FIX: Track whether we're in the middle of a cleanup/retry delay.
  // Prevents the auto-join effect from firing while the old Supabase channel
  // is still shutting down (which causes "WebSocket closed before connection").
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDisconnectingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };
  }, []);

  const join = useCallback(
    async (denKey: DenKey) => {
      // If a retry timer is pending, cancel it — caller is forcing a new join
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      // Disconnect existing connection and wait for cleanup
      if (connectionRef.current) {
        isDisconnectingRef.current = true;
        connectionRef.current.disconnect();
        connectionRef.current = null;
        // Give Supabase time to close the old WebSocket before opening a new one
        // on the same channel name
        await new Promise<void>((resolve) => {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            isDisconnectingRef.current = false;
            resolve();
          }, RETRY_DELAY_MS);
        });
      }

      setError(null);

      if (!validateKey(denKey)) {
        setError("Key is invalid or expired");
        setStatus("offline");
        return;
      }

      const connection = new VisitorConnection(denKey, denKey.denId, options);
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
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
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
