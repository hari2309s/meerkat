/**
 * openDen — creates or opens the two Yjs documents for a den.
 *
 * private.ydoc → IndexedDB, never leaves the device
 * shared.ydoc  → IndexedDB, served to visitors over WebRTC
 *
 * Both docs are persisted via y-indexeddb. The first time a den is opened
 * the databases are created; subsequent opens load instantly from IndexedDB
 * with no network round-trip.
 */

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type {
  DenDocs,
  PrivateDenDoc,
  SharedDenDoc,
  NoteData,
  VoiceMemoData,
  MoodEntry,
  DropboxItem,
  PresenceInfo,
} from "./types.js";
import {
  privateDbName,
  sharedDbName,
  PRIVATE_KEYS,
  SHARED_KEYS,
} from "./constants.js";

// ─── In-memory cache so the same den isn't opened twice ─────────────────────

const openDens = new Map<string, DenDocs>();

/**
 * Opens (or returns a cached instance of) the two Yjs documents for a den.
 *
 * @param denId — Unique identifier for the den (owner's user ID or a UUID).
 * @returns     — Typed handles for both the private and shared documents.
 *
 * @example
 * ```ts
 * const { privateDen, sharedDen } = await openDen(currentUserId);
 * privateDen.notes.observe(() => console.log('notes changed'));
 * ```
 */
export async function openDen(denId: string): Promise<DenDocs> {
  const cached = openDens.get(denId);
  if (cached) return cached;

  const [privateDen, sharedDen] = await Promise.all([
    openPrivateDen(denId),
    openSharedDen(denId),
  ]);

  const docs: DenDocs = { privateDen, sharedDen };
  openDens.set(denId, docs);
  return docs;
}

/**
 * Closes a den's documents and removes them from the in-memory cache.
 * Call this when the user navigates away from the den or logs out.
 */
export function closeDen(denId: string): void {
  const cached = openDens.get(denId);
  if (!cached) return;
  cached.privateDen.destroy();
  cached.sharedDen.destroy();
  openDens.delete(denId);
}

/**
 * Returns true if the given den is currently open in memory.
 */
export function isDenOpen(denId: string): boolean {
  return openDens.has(denId);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function openPrivateDen(denId: string): Promise<PrivateDenDoc> {
  const ydoc = new Y.Doc({ guid: `private-${denId}` });

  const persistence = new IndexeddbPersistence(privateDbName(denId), ydoc);
  await persistence.whenSynced;

  // Typed accessors for each namespace
  const notes = ydoc.getMap<NoteData>(PRIVATE_KEYS.NOTES);
  const voiceMemos = ydoc.getArray<VoiceMemoData>(PRIVATE_KEYS.VOICE_MEMOS);
  const moodJournal = ydoc.getArray<MoodEntry>(PRIVATE_KEYS.MOOD_JOURNAL);
  const settings = ydoc.getMap<unknown>(PRIVATE_KEYS.SETTINGS);

  function destroy(): void {
    persistence.destroy();
    ydoc.destroy();
  }

  return { ydoc, notes, voiceMemos, moodJournal, settings, destroy };
}

async function openSharedDen(denId: string): Promise<SharedDenDoc> {
  const ydoc = new Y.Doc({ guid: `shared-${denId}` });

  const persistence = new IndexeddbPersistence(sharedDbName(denId), ydoc);
  await persistence.whenSynced;

  // Typed accessors for each namespace
  const sharedNotes = ydoc.getMap<NoteData>(SHARED_KEYS.SHARED_NOTES);
  const voiceThread = ydoc.getArray<VoiceMemoData>(SHARED_KEYS.VOICE_THREAD);
  const dropbox = ydoc.getArray<DropboxItem>(SHARED_KEYS.DROPBOX);
  const presence = ydoc.getMap<PresenceInfo>(SHARED_KEYS.PRESENCE);

  function destroy(): void {
    persistence.destroy();
    ydoc.destroy();
  }

  return { ydoc, sharedNotes, voiceThread, dropbox, presence, destroy };
}
