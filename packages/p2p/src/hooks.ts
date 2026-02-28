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

// Max automatic retries before giving up (prevents infinite reconnect loops).
const MAX_AUTO_RETRIES = 5;

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

  // isDisconnectingRef: true when disconnect() was called deliberately.
  // Prevents the onStatusChange("offline") callback from scheduling a retry.
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
    async (denKey: DenKey, retryCount = 0) => {
      // Cancel any pending auto-retry — caller is forcing a new join
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      // Explicit join (not an auto-retry) clears the deliberate-disconnect flag
      if (retryCount === 0) isDisconnectingRef.current = false;

      // Disconnect existing connection and wait for cleanup
      if (connectionRef.current) {
        connectionRef.current.disconnect();
        connectionRef.current = null;
        // Give Supabase time to fully close the old WebSocket for the same
        // channel name before opening a new one.
        await new Promise<void>((resolve) => {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
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

      const visitorId = generateVisitorId();
      const connection = new VisitorConnection(denKey, denKey.denId, options);

      connection.onStatusChange((s) => {
        setStatus(s);
        // Auto-retry on unexpected disconnect (not a deliberate disconnect() call)
        if (s === "offline" && !isDisconnectingRef.current) {
          if (retryCount >= MAX_AUTO_RETRIES) {
            console.warn(
              `[@meerkat/p2p] Max retries (${MAX_AUTO_RETRIES}) reached — giving up`,
            );
            return;
          }
          const next = retryCount + 1;
          console.log(
            `[@meerkat/p2p] Connection dropped — auto-retry ${next}/${MAX_AUTO_RETRIES} in ${RETRY_DELAY_MS}ms`,
          );
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            join(denKey, next).catch(() => {});
          }, RETRY_DELAY_MS);
        }
      });

      connectionRef.current = connection;

      try {
        await connection.connect(visitorId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        setError(msg);
        setStatus("offline");
        // onStatusChange will NOT fire for a thrown error (connect() threw before
        // the status handler could fire), so schedule retry directly here.
        if (!isDisconnectingRef.current && retryCount < MAX_AUTO_RETRIES) {
          const next = retryCount + 1;
          console.log(
            `[@meerkat/p2p] Handshake failed — auto-retry ${next}/${MAX_AUTO_RETRIES} in ${RETRY_DELAY_MS}ms`,
          );
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            join(denKey, next).catch(() => {});
          }, RETRY_DELAY_MS);
        }
      }
    },
    [options],
  );

  const disconnect = useCallback(() => {
    isDisconnectingRef.current = true;
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
