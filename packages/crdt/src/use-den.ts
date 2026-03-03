/**
 * @meerkat/crdt — useDen hook
 *
 * The primary interface for the app. Returns the full, hydrated den state
 * including notes, voice memos, shared content, visitor presence, sync
 * status, and bound actions.
 *
 * Two usage modes:
 *
 * 1. Inside a <DenProvider> (recommended for pages):
 *    The hook reads from context — zero additional subscriptions.
 *
 *    <DenProvider denId={id}>
 *      <MyComponent />        ← useDen(id) here reads from context
 *    </DenProvider>
 *
 * 2. Standalone (for isolated components or modals outside the provider):
 *    The hook manages its own local state with Yjs observers and the
 *    sync machine. More expensive — prefer the DenProvider pattern.
 *
 * In both cases the return shape is identical: DenState.
 *
 * ─── What was removed ────────────────────────────────────────────────────────
 *
 * The OLD crdt package had:
 *   ✗  legacy subscription setup — REMOVED
 *   ✗  legacy cleanup useEffect — REMOVED
 *   - useDenMessages() reading from Supabase query       ← REMOVED
 *   - useDenPresence() polling Supabase Presence         ← REMOVED
 *
 * All content now comes from Yjs (IndexedDB). All presence comes from
 * the shared.ydoc presence namespace (written by @meerkat/p2p over WebRTC).
 */

"use client";

import { useState, useEffect, useCallback } from "react";
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
  DenState,
  SyncStatus,
  SharedDenView,
  DenActions,
} from "./types.js";
import { useDenContextSafe } from "./context.js";
import { resolveP2PAdapter, getAdapterSync } from "./p2p-adapter.js";
import { getOrCreateMachine } from "./sync-machine.js";

// ─── Public hook ─────────────────────────────────────────────────────────────

/**
 * Returns the full, hydrated den state.
 *
 * @param denId — The den to open. Typically the owner's user ID.
 *
 * @example
 * ```tsx
 * function DenPage({ denId }: { denId: string }) {
 *   const { notes, voiceMemos, shared, visitors, syncStatus, isLoading, actions } =
 *     useDen(denId);
 *
 *   if (isLoading) return <DenSkeleton />;
 *
 *   return (
 *     <>
 *       <SyncBadge status={syncStatus} />
 *       <NoteList notes={notes} onNew={actions.createNote} />
 *       <VoiceMemoList memos={voiceMemos} />
 *       <VisitorList visitors={visitors} />
 *     </>
 *   );
 * }
 * ```
 */
export function useDen(denId: string): DenState {
  // If a DenProvider is mounted above us, just read from context — no extra work.
  const contextValue = useDenContextSafe();
  if (contextValue !== null) {
    return contextValue;
  }

  // Otherwise, run in standalone mode.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useStandaloneDen(denId);
}

// ─── Standalone mode (no DenProvider above) ───────────────────────────────────

/**
 * Manages its own Yjs subscriptions and sync machine.
 * Identical state shape to the context-based path — consumers can't tell
 * which mode is active.
 *
 * NOTE: This hook intentionally mirrors the DenProvider logic.
 * Keep both in sync if you change the data model.
 */
function useStandaloneDen(denId: string): DenState {
  const [docs, setDocs] = useState<DenDocs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [notes, setNotes] = useState<NoteData[]>([]);
  const [voiceMemos, setVoiceMemos] = useState<VoiceMemoData[]>([]);
  const [shared, setShared] = useState<SharedDenView>({
    notes: [],
    voiceThread: [],
    dropbox: [],
    chatThread: []
  });
  const [visitors, setVisitors] = useState<PresenceInfo[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    getAdapterSync().getStatus(denId),
  );

  // ── Open docs ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    openDen(denId)
      .then((d) => {
        if (!cancelled) {
          setDocs(d);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [denId]);

  // ── Wire Yjs observers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!docs) return;

    const { privateDen, sharedDen } = docs;

    const readNotes = () => {
      const all = Array.from(privateDen.notes.values());
      setNotes(all.sort((a, b) => b.updatedAt - a.updatedAt));
    };

    const readVoiceMemos = () => {
      const all = privateDen.voiceMemos.toArray();
      setVoiceMemos([...all].sort((a, b) => b.createdAt - a.createdAt));
    };

    const readShared = () => {
      setShared({
        notes: Array.from(sharedDen.sharedNotes.values()).sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
        voiceThread: sharedDen.voiceThread.toArray(),
        dropbox: sharedDen.dropbox.toArray(),
        chatThread: sharedDen.chatThread.toArray(),
      });
    };

    const readPresence = () => {
      const now = Date.now();
      const live = Array.from(sharedDen.presence.values()).filter(
        (p) => now - p.lastSeenAt < 60_000,
      );
      setVisitors(live);
    };

    // Initial reads
    readNotes();
    readVoiceMemos();
    readShared();
    readPresence();

    // Subscribe
    privateDen.notes.observe(readNotes);
    privateDen.voiceMemos.observe(readVoiceMemos);
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

  // ── Sync machine ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    resolveP2PAdapter().then((adapter) => {
      const machine = getOrCreateMachine(denId, adapter);
      const unsubscribe = machine.subscribe((status) => setSyncStatus(status));
      const stopHosting = machine.start();
      cleanup = () => {
        unsubscribe();
        stopHosting();
      };
    });

    return () => cleanup?.();
  }, [denId]);

  // ── Bound actions ─────────────────────────────────────────────────────────
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

  return {
    notes,
    voiceMemos,
    shared,
    visitors,
    syncStatus,
    isLoading,
    error,
    actions,
  };
}
