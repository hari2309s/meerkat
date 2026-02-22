/**
 * React hooks for @meerkat/local-store.
 *
 * These hooks subscribe to Yjs document changes and trigger re-renders
 * only when the relevant data changes. They are the primary interface
 * for React components — components should never access Y.Doc directly.
 *
 * All hooks follow the same pattern:
 *   1. Open the den (cached — no extra cost if already open).
 *   2. Read the initial value.
 *   3. Subscribe to Yjs changes and update state.
 *   4. Unsubscribe on unmount.
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type * as Y from "yjs";
import { openDen } from "./den.js";

import type {
  NoteData,
  VoiceMemoData,
  MoodEntry,
  DropboxItem,
  PresenceInfo,
  DenDocs,
  DenStatus,
} from "./types.js";

// ─── Den lifecycle hook ──────────────────────────────────────────────────────

/**
 * Opens a den and returns its docs + status.
 * Handles the async open and tracks loading / error state.
 *
 * @example
 * ```tsx
 * const { docs, status } = useDen(denId);
 * if (status === 'open') { ... }
 * ```
 */
export function useDen(denId: string): {
  docs: DenDocs | null;
  status: DenStatus;
  error: Error | null;
} {
  const [docs, setDocs] = useState<DenDocs | null>(null);
  const [status, setStatus] = useState<DenStatus>("opening");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("opening");

    openDen(denId)
      .then((d) => {
        if (!cancelled) {
          setDocs(d);
          setStatus("open");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      // Don't auto-close on unmount — other components might still use it.
      // Callers that want to close should call closeDen() explicitly.
    };
  }, [denId]);

  return { docs, status, error };
}

// ─── Note hooks ──────────────────────────────────────────────────────────────

/**
 * Subscribes to a single note by ID.
 * Returns undefined while loading or if the note doesn't exist.
 *
 * @example
 * ```tsx
 * const note = useNote(denId, noteId);
 * if (!note) return <Skeleton />;
 * return <NoteCard note={note} />;
 * ```
 */
export function useNote(denId: string, noteId: string): NoteData | undefined {
  const [note, setNote] = useState<NoteData | undefined>(undefined);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ privateDen }) => {
      // Read initial value
      setNote(privateDen.notes.get(noteId));

      // Subscribe to changes on the notes map
      const handler = (event: Y.YMapEvent<NoteData>) => {
        if (event.keysChanged.has(noteId)) {
          setNote(privateDen.notes.get(noteId));
        }
      };

      privateDen.notes.observe(handler);
      cleanup = () => privateDen.notes.unobserve(handler);
    });

    return () => cleanup?.();
  }, [denId, noteId]);

  return note;
}

/**
 * Subscribes to all notes in the private den.
 * Re-renders only when the notes map changes.
 * Returns notes sorted newest-first.
 *
 * @example
 * ```tsx
 * const notes = useAllNotes(denId);
 * return notes.map(n => <NoteCard key={n.id} note={n} />);
 * ```
 */
export function useAllNotes(denId: string): NoteData[] {
  const [notes, setNotes] = useState<NoteData[]>([]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ privateDen }) => {
      const readNotes = () => {
        const all = Array.from(privateDen.notes.values());
        setNotes(all.sort((a, b) => b.updatedAt - a.updatedAt));
      };

      readNotes(); // Initial read

      privateDen.notes.observe(readNotes);
      cleanup = () => privateDen.notes.unobserve(readNotes);
    });

    return () => cleanup?.();
  }, [denId]);

  return notes;
}

/**
 * Subscribes to the shared notes in the shared doc.
 * Useful for the host to preview what visitors see.
 */
export function useSharedNotes(denId: string): NoteData[] {
  const [notes, setNotes] = useState<NoteData[]>([]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ sharedDen }) => {
      const readNotes = () => {
        const all = Array.from(sharedDen.sharedNotes.values());
        setNotes(all.sort((a, b) => b.updatedAt - a.updatedAt));
      };

      readNotes();
      sharedDen.sharedNotes.observe(readNotes);
      cleanup = () => sharedDen.sharedNotes.unobserve(readNotes);
    });

    return () => cleanup?.();
  }, [denId]);

  return notes;
}

// ─── Voice memo hooks ─────────────────────────────────────────────────────────

/**
 * Subscribes to a single voice memo by ID.
 *
 * @example
 * ```tsx
 * const memo = useVoiceMemo(denId, memoId);
 * ```
 */
export function useVoiceMemo(
  denId: string,
  memoId: string,
): VoiceMemoData | undefined {
  const [memo, setMemo] = useState<VoiceMemoData | undefined>(undefined);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ privateDen }) => {
      const find = () =>
        privateDen.voiceMemos.toArray().find((m) => m.id === memoId);

      setMemo(find());

      const handler = () => setMemo(find());
      privateDen.voiceMemos.observe(handler);
      cleanup = () => privateDen.voiceMemos.unobserve(handler);
    });

    return () => cleanup?.();
  }, [denId, memoId]);

  return memo;
}

/**
 * Subscribes to all voice memos in the private den.
 * Returns memos sorted newest-first.
 */
export function useAllVoiceMemos(denId: string): VoiceMemoData[] {
  const [memos, setMemos] = useState<VoiceMemoData[]>([]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ privateDen }) => {
      const read = () => {
        const all = privateDen.voiceMemos.toArray();
        setMemos([...all].sort((a, b) => b.createdAt - a.createdAt));
      };

      read();
      privateDen.voiceMemos.observe(read);
      cleanup = () => privateDen.voiceMemos.unobserve(read);
    });

    return () => cleanup?.();
  }, [denId]);

  return memos;
}

// ─── Mood journal hook ───────────────────────────────────────────────────────

/**
 * Subscribes to the mood journal for the den.
 * Returns entries oldest-first (good for charting over time).
 */
export function useMoodJournal(denId: string): MoodEntry[] {
  const [entries, setEntries] = useState<MoodEntry[]>([]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ privateDen }) => {
      const read = () => setEntries(privateDen.moodJournal.toArray());
      read();
      privateDen.moodJournal.observe(read);
      cleanup = () => privateDen.moodJournal.unobserve(read);
    });

    return () => cleanup?.();
  }, [denId]);

  return entries;
}

// ─── Dropbox hook ────────────────────────────────────────────────────────────

/**
 * Subscribes to the visitor dropbox in the shared doc.
 * Returns items oldest-first.
 */
export function useDropbox(denId: string): DropboxItem[] {
  const [items, setItems] = useState<DropboxItem[]>([]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ sharedDen }) => {
      const read = () => setItems(sharedDen.dropbox.toArray());
      read();
      sharedDen.dropbox.observe(read);
      cleanup = () => sharedDen.dropbox.unobserve(read);
    });

    return () => cleanup?.();
  }, [denId]);

  return items;
}

// ─── Presence hook ───────────────────────────────────────────────────────────

/**
 * Subscribes to the ephemeral presence map in the shared doc.
 * Returns an array of currently-connected visitors.
 *
 * Note: Presence entries are set by @meerkat/p2p when visitors connect
 * via WebRTC. This hook just reads from the shared Yjs doc.
 */
export function usePresence(denId: string): PresenceInfo[] {
  const [presence, setPresence] = useState<PresenceInfo[]>([]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ sharedDen }) => {
      const now = Date.now();
      const read = () => {
        const all = Array.from(sharedDen.presence.values());
        // Filter out stale entries (e.g., browser closed without cleanup)
        const live = all.filter((p) => now - p.lastSeenAt < 60_000);
        setPresence(live);
      };
      read();
      sharedDen.presence.observe(read);
      cleanup = () => sharedDen.presence.unobserve(read);
    });

    return () => cleanup?.();
  }, [denId]);

  return presence;
}

// ─── Settings hook ───────────────────────────────────────────────────────────

/**
 * Reads and subscribes to a single setting value in the private doc.
 *
 * @example
 * ```tsx
 * const theme = useSetting<'light' | 'dark'>(denId, 'theme', 'light');
 * ```
 */
export function useSetting<T = unknown>(
  denId: string,
  key: string,
  defaultValue: T,
): T {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    openDen(denId).then(({ privateDen }) => {
      const read = () => {
        const stored = privateDen.settings.get(key);
        setValue(stored !== undefined ? (stored as T) : defaultValue);
      };

      read();

      const handler = (event: Y.YMapEvent<unknown>) => {
        if (event.keysChanged.has(key)) read();
      };

      privateDen.settings.observe(handler);
      cleanup = () => privateDen.settings.unobserve(handler);
    });

    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denId, key]);

  return value;
}

/**
 * Returns a stable setter for a den setting.
 *
 * @example
 * ```tsx
 * const setTheme = useSetSetting<'light' | 'dark'>(denId, 'theme');
 * <button onClick={() => setTheme('dark')}>Dark mode</button>
 * ```
 */
export function useSetSetting<T = unknown>(
  denId: string,
  key: string,
): (value: T) => void {
  const docsRef = useRef<DenDocs | null>(null);

  useEffect(() => {
    openDen(denId).then((docs) => {
      docsRef.current = docs;
    });
  }, [denId]);

  return useCallback(
    (value: T) => {
      const docs = docsRef.current;
      if (!docs) return;
      docs.privateDen.ydoc.transact(() => {
        docs.privateDen.settings.set(key, value);
      });
    },
    [key],
  );
}
