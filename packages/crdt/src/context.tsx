/**
 * @meerkat/crdt — DenContext and DenProvider
 *
 * DenProvider is the single integration point for a den page.
 * It:
 *   1. Opens the two Yjs docs from @meerkat/local-store
 *   2. Starts the sync state machine (wires to @meerkat/p2p when available)
 *   3. Provides the full DenState to all descendant components via context
 *
 * Usage:
 *
 *   // In your den page layout:
 *   <DenProvider denId={params.denId}>
 *     <DenPageContent />
 *   </DenProvider>
 *
 *   // In any descendant component:
 *   const { notes, syncStatus, actions } = useDenContext();
 *
 * DenProvider replaces the old legacy subscription setup that
 * previously lived in den-page-client.tsx. There are no legacy
 * calls here. Content comes from IndexedDB (offline-first) and live updates
 * come from Yjs observers.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  openDen,
  createNote as storeCreateNote,
  updateNote as storeUpdateNote,
  deleteNote as storeDeleteNote,
  searchNotes as storeSearchNotes,
} from "@meerkat/local-store";
import type {
  NoteData,
  VoiceMemoData,
  PresenceInfo,
  DenDocs,
} from "@meerkat/local-store";
import type {
  DenContextValue,
  DenState,
  SyncStatus,
  SharedDenView,
  DenActions,
} from "./types.js";
import { resolveP2PAdapter, getAdapterSync } from "./p2p-adapter.js";
import { getOrCreateMachine } from "./sync-machine.js";

// ─── Context ──────────────────────────────────────────────────────────────────

const DenContext = createContext<DenContextValue>(null);

DenContext.displayName = "DenContext";

// ─── DenProvider ─────────────────────────────────────────────────────────────

interface DenProviderProps {
  denId: string;
  children: ReactNode;
  /**
   * When true, the den will NOT attempt to start the P2P layer.
   * Useful for read-only visitor views or embedded previews.
   */
  readOnly?: boolean;
}

/**
 * Provides full den state to all descendant components.
 *
 * Initialises @meerkat/local-store docs, wires up Yjs observers for
 * live data, starts the sync state machine, and exposes bound actions.
 *
 * Replaces all legacy subscription setup previously in
 * den-page-client.tsx.
 */
export function DenProvider({
  denId,
  children,
  readOnly = false,
}: DenProviderProps) {
  // ── Local doc state ────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<DenDocs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ── Content state (derived from Yjs observers) ─────────────────────────────
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [voiceMemos, setVoiceMemos] = useState<VoiceMemoData[]>([]);
  const [shared, setShared] = useState<SharedDenView>({
    notes: [],
    voiceThread: [],
    dropbox: [],
  });
  const [visitors, setVisitors] = useState<PresenceInfo[]>([]);

  // ── Sync state ─────────────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");

  // Ref so we never re-run effects when denId changes within a mounted provider
  const denIdRef = useRef(denId);
  denIdRef.current = denId;

  // ── Step 1: Open docs from IndexedDB ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    openDen(denId)
      .then((openedDocs) => {
        if (cancelled) return;
        setDocs(openedDocs);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      // Don't close the den on unmount — the user might navigate back.
      // Explicit close happens on logout; see clearDenLocalData().
    };
  }, [denId]);

  // ── Step 2: Wire Yjs observers once docs are open ─────────────────────────
  useEffect(() => {
    if (!docs) return;

    const { privateDen, sharedDen } = docs;

    // ── Private doc observers ──────────────────────────────────────────────

    const readNotes = () => {
      const all = Array.from(privateDen.notes.values());
      setNotes(all.sort((a, b) => b.updatedAt - a.updatedAt));
    };

    const readVoiceMemos = () => {
      const all = privateDen.voiceMemos.toArray();
      setVoiceMemos([...all].sort((a, b) => b.createdAt - a.createdAt));
    };

    readNotes();
    readVoiceMemos();

    privateDen.notes.observe(readNotes);
    privateDen.voiceMemos.observe(readVoiceMemos);

    // ── Shared doc observers ───────────────────────────────────────────────

    const readShared = () => {
      setShared({
        notes: Array.from(sharedDen.sharedNotes.values()).sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
        voiceThread: sharedDen.voiceThread.toArray(),
        dropbox: sharedDen.dropbox.toArray(),
      });
    };

    const readPresence = () => {
      const now = Date.now();
      const all = Array.from(sharedDen.presence.values());
      // Prune stale presence entries (browser closed without cleanup)
      const live = all.filter((p) => now - p.lastSeenAt < 60_000);
      setVisitors(live);
    };

    readShared();
    readPresence();

    sharedDen.sharedNotes.observe(readShared);
    sharedDen.voiceThread.observe(readShared);
    sharedDen.dropbox.observe(readShared);
    sharedDen.presence.observe(readPresence);

    return () => {
      privateDen.notes.unobserve(readNotes);
      privateDen.voiceMemos.unobserve(readVoiceMemos);
      sharedDen.sharedNotes.unobserve(readShared);
      sharedDen.voiceThread.unobserve(readShared);
      sharedDen.dropbox.unobserve(readShared);
      sharedDen.presence.unobserve(readPresence);
    };
  }, [docs]);

  // ── Step 3: Start the sync state machine ──────────────────────────────────
  useEffect(() => {
    if (readOnly) return;

    let stopMachine: (() => void) | undefined;

    // Resolve the adapter (may be the no-op offline adapter in Phase 1–3)
    resolveP2PAdapter().then((adapter) => {
      const machine = getOrCreateMachine(denId, adapter);

      // Subscribe to status changes
      const unsubscribe = machine.subscribe((status) => {
        setSyncStatus(status);
      });

      // Start hosting (no-op if adapter is offline)
      stopMachine = machine.start();

      // Return cleanup
      return () => {
        unsubscribe();
        stopMachine?.();
      };
    });

    return () => {
      stopMachine?.();
    };
  }, [denId, readOnly]);

  // ── Step 4: Also seed syncStatus synchronously from cached adapter ────────
  // (avoids a flash of 'offline' when the machine is already running)
  useEffect(() => {
    const adapter = getAdapterSync();
    setSyncStatus(adapter.getStatus(denId));
  }, [denId]);

  // ── Bound actions ──────────────────────────────────────────────────────────
  const actions: DenActions = {
    createNote: useCallback((input) => storeCreateNote(denId, input), [denId]),
    updateNote: useCallback(
      (id, input) => storeUpdateNote(denId, id, input),
      [denId],
    ),
    deleteNote: useCallback((id) => storeDeleteNote(denId, id), [denId]),
    searchNotes: useCallback(
      (options) => storeSearchNotes(denId, options),
      [denId],
    ),
  };

  // ── Compose the context value ──────────────────────────────────────────────
  const value: DenState = {
    notes,
    voiceMemos,
    shared,
    visitors,
    syncStatus,
    isLoading,
    error,
    actions,
  };

  return <DenContext.Provider value={value}>{children}</DenContext.Provider>;
}

// ─── Consumer hooks ───────────────────────────────────────────────────────────

/**
 * Returns the full den state from the nearest DenProvider.
 *
 * @throws {Error} if called outside a DenProvider.
 *
 * @example
 * ```tsx
 * const { notes, syncStatus, actions } = useDenContext();
 * ```
 */
export function useDenContext(): DenState {
  const value = useContext(DenContext);
  if (value === null) {
    throw new Error(
      "[@meerkat/crdt] useDenContext must be called inside a <DenProvider>",
    );
  }
  return value;
}

/**
 * Returns the raw context value without throwing.
 * Returns null if no DenProvider is mounted.
 */
export function useDenContextSafe(): DenContextValue {
  return useContext(DenContext);
}
