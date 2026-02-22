/**
 * @meerkat/local-store — internal types
 *
 * Full types come from @meerkat/types. These are the shapes this package
 * owns or that it needs before @meerkat/types is fully refactored.
 */

// ─── Den document structure ─────────────────────────────────────────────────

/**
 * The two Yjs documents that make up a den.
 * private.ydoc → never leaves the device
 * shared.ydoc  → served over WebRTC to visitors
 */
export interface DenDocs {
  privateDen: PrivateDenDoc;
  sharedDen: SharedDenDoc;
}

/**
 * Typed handle for the private Yjs document.
 * Wraps the raw Y.Doc with typed accessors for each namespace.
 */
export interface PrivateDenDoc {
  /** Raw Yjs document — use sparingly; prefer typed accessors. */
  readonly ydoc: import("yjs").Doc;
  /** All private notes keyed by note ID. */
  readonly notes: import("yjs").Map<NoteData>;
  /** Private voice memo entries keyed by memo ID. */
  readonly voiceMemos: import("yjs").Array<VoiceMemoData>;
  /** Emotion history journal entries (append-only). */
  readonly moodJournal: import("yjs").Array<MoodEntry>;
  /** Den configuration and user settings. */
  readonly settings: import("yjs").Map<unknown>;
  /** Destroy the doc and clean up the IndexedDB provider. */
  destroy(): void;
}

/**
 * Typed handle for the shared Yjs document.
 * Served peer-to-peer to visitors with valid capability keys.
 */
export interface SharedDenDoc {
  /** Raw Yjs document — use sparingly; prefer typed accessors. */
  readonly ydoc: import("yjs").Doc;
  /** Notes surfaced to visitors (subset of private notes). */
  readonly sharedNotes: import("yjs").Map<NoteData>;
  /** Voice notes in the shared thread. */
  readonly voiceThread: import("yjs").Array<VoiceMemoData>;
  /** Visitor-write dropbox — host reads, visitors write. */
  readonly dropbox: import("yjs").Array<DropboxItem>;
  /** Ephemeral presence map — who is currently in the den. */
  readonly presence: import("yjs").Map<PresenceInfo>;
  /** Destroy the doc and clean up the IndexedDB provider. */
  destroy(): void;
}

// ─── Content types ───────────────────────────────────────────────────────────

/** A local-first note. No server FK, no Supabase row shape. */
export interface NoteData {
  id: string;
  content: string;
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms
  /** Whether this note has been surfaced to the shared doc. */
  isShared: boolean;
  /** Tags for local filtering. */
  tags: string[];
}

/** A local-first voice memo entry. Blob lives in Supabase Storage encrypted. */
export interface VoiceMemoData {
  id: string;
  /** Reference to the encrypted blob in Supabase Storage. */
  blobRef: string;
  /** Duration in seconds. */
  durationSeconds: number;
  createdAt: number; // Unix ms
  /** Analysis results from @meerkat/analyzer (if available). */
  analysis?: {
    transcript: string;
    mood: string;
    tone: string;
    valence: number;
    arousal: number;
    confidence: number;
    analysedAt: number; // Unix ms
  } | undefined;
}

/** A single entry in the local mood journal. */
export interface MoodEntry {
  id: string;
  /** Source voice memo, if applicable. */
  voiceMemoId?: string | undefined;
  mood: string;
  valence: number;
  arousal: number;
  recordedAt: number; // Unix ms
}

/** A visitor-dropped item in the shared doc dropbox namespace. */
export interface DropboxItem {
  id: string;
  /** Encrypted payload — only the host can decrypt this. */
  encryptedPayload: Uint8Array | string;
  /** The visitor's ephemeral public identity (not a Meerkat account). */
  visitorId: string;
  droppedAt: number; // Unix ms
}

/** Ephemeral presence info for a connected visitor. */
export interface PresenceInfo {
  visitorId: string;
  displayName: string;
  /** The namespace scopes their key grants. */
  scopes: string[];
  connectedAt: number; // Unix ms
  lastSeenAt: number; // Unix ms
}

// ─── Operation result types ──────────────────────────────────────────────────

export type CreateNoteInput = {
  content: string;
  tags?: string[];
  isShared?: boolean;
};

export type UpdateNoteInput = Partial<
  Pick<NoteData, "content" | "tags" | "isShared">
>;

export type SearchNotesOptions = {
  query: string;
  /** Limit results. Defaults to 50. */
  limit?: number;
  /** Only return shared notes. */
  sharedOnly?: boolean;
  /** Filter by tags. */
  tags?: string[];
};

/** The lifecycle state of a den (both docs). */
export type DenStatus = "closed" | "opening" | "open" | "error";

/** A minimal event emitted when den state changes. */
export type DenEvent =
  | { type: "note:created"; note: NoteData }
  | { type: "note:updated"; note: NoteData }
  | { type: "note:deleted"; id: string }
  | { type: "voice-memo:created"; memo: VoiceMemoData }
  | { type: "dropbox:item-added"; item: DropboxItem }
  | { type: "den:opened"; denId: string }
  | { type: "den:closed"; denId: string }
  | { type: "den:error"; denId: string; error: Error };
