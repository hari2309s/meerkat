/**
 * Storage key helpers and constants for @meerkat/local-store.
 */

/** IndexedDB database name prefix — each den gets its own db. */
export const IDB_PREFIX = "meerkat-den";

/** Returns the IndexedDB name for the private doc of a den. */
export function privateDbName(denId: string): string {
  return `${IDB_PREFIX}-private-${denId}`;
}

/** Returns the IndexedDB name for the shared doc of a den. */
export function sharedDbName(denId: string): string {
  return `${IDB_PREFIX}-shared-${denId}`;
}

// ─── Yjs map / array keys ───────────────────────────────────────────────────

/** Top-level key names inside private.ydoc */
export const PRIVATE_KEYS = {
  NOTES: "notes",
  VOICE_MEMOS: "voiceMemos",
  MOOD_JOURNAL: "moodJournal",
  SETTINGS: "settings",
} as const;

/** Top-level key names inside shared.ydoc */
export const SHARED_KEYS = {
  SHARED_NOTES: "sharedNotes",
  VOICE_THREAD: "voiceThread",
  DROPBOX: "dropbox",
  PRESENCE: "presence",
} as const;

/** How long a presence entry is considered "live" before being pruned (ms). */
export const PRESENCE_TTL_MS = 30_000;

/** Maximum number of search results returned by searchNotes(). */
export const DEFAULT_SEARCH_LIMIT = 50;
