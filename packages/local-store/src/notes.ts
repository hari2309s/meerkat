/**
 * Note operations for @meerkat/local-store.
 *
 * All writes go through Yjs transactions so they are automatically
 * persisted to IndexedDB and will sync to visitors over WebRTC
 * (for shared notes) when @meerkat/p2p is active.
 */

import { openDen } from "./den.js";
import type {
  NoteData,
  CreateNoteInput,
  UpdateNoteInput,
  SearchNotesOptions,
} from "./types.js";
import { DEFAULT_SEARCH_LIMIT } from "./constants.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  // crypto.randomUUID() is available in all modern browsers and Node 14.17+
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Creates a new note in the private den.
 *
 * If `isShared` is true the note is also mirrored into shared.ydoc so
 * visitors with the appropriate key can read it.
 *
 * @example
 * ```ts
 * const note = await createNote(denId, { content: 'First thought' });
 * ```
 */
export async function createNote(
  denId: string,
  input: CreateNoteInput,
): Promise<NoteData> {
  const { privateDen, sharedDen } = await openDen(denId);

  const note: NoteData = {
    id: generateId(),
    content: input.content,
    tags: input.tags ?? [],
    isShared: input.isShared ?? false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Write to private doc
  privateDen.ydoc.transact(() => {
    privateDen.notes.set(note.id, note);
  });

  // Mirror to shared doc if flagged
  if (note.isShared) {
    sharedDen.ydoc.transact(() => {
      sharedDen.sharedNotes.set(note.id, note);
    });
  }

  return note;
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Returns a single note by ID, or undefined if it doesn't exist.
 */
export async function getNote(
  denId: string,
  noteId: string,
): Promise<NoteData | undefined> {
  const { privateDen } = await openDen(denId);
  return privateDen.notes.get(noteId);
}

/**
 * Returns all notes in the private den, sorted newest-first.
 */
export async function getAllNotes(denId: string): Promise<NoteData[]> {
  const { privateDen } = await openDen(denId);
  const notes = Array.from(privateDen.notes.values());
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Searches notes by content and optional filters.
 * This is a local, synchronous search over the in-memory Yjs map.
 *
 * For large dens consider building a local search index (e.g. Fuse.js),
 * but for typical personal note volumes this is fast enough.
 *
 * @example
 * ```ts
 * const results = await searchNotes(denId, { query: 'morning', tags: ['journal'] });
 * ```
 */
export async function searchNotes(
  denId: string,
  options: SearchNotesOptions,
): Promise<NoteData[]> {
  const { privateDen } = await openDen(denId);
  const {
    query,
    limit = DEFAULT_SEARCH_LIMIT,
    sharedOnly = false,
    tags,
  } = options;

  const needle = query.toLowerCase().trim();

  const results: NoteData[] = [];

  for (const note of privateDen.notes.values()) {
    if (results.length >= limit) break;

    if (sharedOnly && !note.isShared) continue;

    if (tags && tags.length > 0) {
      const hasAllTags = tags.every((t) => note.tags.includes(t));
      if (!hasAllTags) continue;
    }

    if (needle && !note.content.toLowerCase().includes(needle)) continue;

    results.push(note);
  }

  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

// ─── Update ──────────────────────────────────────────────────────────────────

/**
 * Updates an existing note. Only the provided fields are changed.
 *
 * If `isShared` is toggled, the note is added to or removed from the
 * shared doc accordingly.
 *
 * @throws {Error} if the note is not found.
 */
export async function updateNote(
  denId: string,
  noteId: string,
  input: UpdateNoteInput,
): Promise<NoteData> {
  const { privateDen, sharedDen } = await openDen(denId);

  const existing = privateDen.notes.get(noteId);
  if (!existing) {
    throw new Error(`Note not found: ${noteId}`);
  }

  const wasShared = existing.isShared;
  const updated: NoteData = {
    ...existing,
    ...input,
    updatedAt: Date.now(),
  };

  privateDen.ydoc.transact(() => {
    privateDen.notes.set(noteId, updated);
  });

  const isNowShared = updated.isShared;

  sharedDen.ydoc.transact(() => {
    if (isNowShared) {
      // Add or update in shared doc
      sharedDen.sharedNotes.set(noteId, updated);
    } else if (wasShared && !isNowShared) {
      // Remove from shared doc — it's been made private again
      sharedDen.sharedNotes.delete(noteId);
    }
  });

  return updated;
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Permanently deletes a note from both private and shared docs.
 *
 * In a Yjs CRDT this is a tombstone operation — the entry is removed
 * from the map but the deletion itself is preserved so it can propagate
 * to connected visitors.
 *
 * @throws {Error} if the note is not found.
 */
export async function deleteNote(denId: string, noteId: string): Promise<void> {
  const { privateDen, sharedDen } = await openDen(denId);

  if (!privateDen.notes.has(noteId)) {
    throw new Error(`Note not found: ${noteId}`);
  }

  privateDen.ydoc.transact(() => {
    privateDen.notes.delete(noteId);
  });

  // Also remove from shared doc if it was shared
  if (sharedDen.sharedNotes.has(noteId)) {
    sharedDen.ydoc.transact(() => {
      sharedDen.sharedNotes.delete(noteId);
    });
  }
}
