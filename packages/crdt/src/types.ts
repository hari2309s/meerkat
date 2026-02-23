/**
 * @meerkat/crdt — types
 *
 * The types in this file are the public contract of the orchestration layer.
 * They are what the app imports and consumes — not the raw Yjs structures
 * from @meerkat/local-store.
 *
 * SyncStatus models the state machine:
 *
 *   offline ──► connecting ──► synced
 *                               │
 *                               ▼
 *                            hosting  (when the host side has active visitors)
 *
 * Transitions:
 *   offline    → connecting  : network comes back, P2P begins handshake
 *   connecting → synced      : P2P established, docs in sync
 *   connecting → offline     : handshake failed or timed out
 *   synced     → hosting     : first visitor connects
 *   hosting    → synced      : last visitor disconnects
 *   any        → offline     : network lost / den closed
 */

import type {
  NoteData,
  VoiceMemoData,
  DropboxItem,
  PresenceInfo,
  CreateNoteInput,
  UpdateNoteInput,
  SearchNotesOptions,
} from "@meerkat/local-store";

// ─── SyncStatus ───────────────────────────────────────────────────────────────

/**
 * The sync lifecycle for a den.
 *
 * - `offline`    — No P2P connection. Reading from local IndexedDB only.
 * - `connecting` — P2P handshake in progress (signaling, ICE, etc.)
 * - `synced`     — Connected to the P2P layer; shared.ydoc is live.
 * - `hosting`    — Synced AND at least one visitor is actively connected.
 */
export type SyncStatus = "offline" | "connecting" | "synced" | "hosting";

// ─── Shared den view ─────────────────────────────────────────────────────────

/** The subset of the den surfaced to visitors over the shared doc. */
export interface SharedDenView {
  /** Notes the host has marked as shared. */
  notes: NoteData[];
  /** Voice notes in the shared thread. */
  voiceThread: VoiceMemoData[];
  /** Visitor-write dropbox items (host-read). */
  dropbox: DropboxItem[];
}

// ─── Den actions ─────────────────────────────────────────────────────────────

/**
 * Bound action functions returned by useDen.
 * These are stable references — safe to use in dependency arrays.
 */
export interface DenActions {
  /** Create a new private note. */
  createNote: (input: CreateNoteInput) => Promise<NoteData>;
  /** Update fields on an existing note. */
  updateNote: (id: string, input: UpdateNoteInput) => Promise<NoteData>;
  /** Delete a note from both private and shared docs. */
  deleteNote: (id: string) => Promise<void>;
  /** Search notes by content, tags, or shared flag. */
  searchNotes: (options: SearchNotesOptions) => Promise<NoteData[]>;
}

// ─── The full den state ───────────────────────────────────────────────────────

/**
 * The complete, hydrated den state returned by useDen().
 *
 * This is the primary interface for all UI components.
 * No component should import from @meerkat/local-store directly.
 *
 * @example
 * ```tsx
 * const { notes, syncStatus, actions } = useDen(denId);
 * // notes is NoteData[], live-updating from Yjs
 * // syncStatus tells you if P2P is active
 * // actions.createNote(...) writes to local-store
 * ```
 */
export interface DenState {
  // ── Private content ──────────────────────────────────────────────────────

  /** All private notes, sorted newest-first. Live-updating from Yjs. */
  notes: NoteData[];

  /** All private voice memos, sorted newest-first. Live-updating from Yjs. */
  voiceMemos: VoiceMemoData[];

  // ── Shared content ───────────────────────────────────────────────────────

  /** The portion of the den that is shared with visitors. */
  shared: SharedDenView;

  // ── Visitors ─────────────────────────────────────────────────────────────

  /**
   * Currently-connected visitors. Only populated when syncStatus is
   * 'hosting'. Set by @meerkat/p2p via the presence namespace in shared.ydoc.
   */
  visitors: PresenceInfo[];

  // ── Sync state ────────────────────────────────────────────────────────────

  /** Current sync lifecycle state. */
  syncStatus: SyncStatus;

  // ── Loading & error ───────────────────────────────────────────────────────

  /**
   * True while the den is opening from IndexedDB for the first time.
   * Once false, content is available even without a network connection.
   */
  isLoading: boolean;

  /** Non-null if the den failed to open. */
  error: Error | null;

  // ── Bound actions ─────────────────────────────────────────────────────────

  /** Stable-reference CRUD actions bound to this den. */
  actions: DenActions;
}

// ─── Context value ────────────────────────────────────────────────────────────

/**
 * The value held by DenContext (provided by DenProvider).
 * null means no DenProvider is mounted above the component.
 */
export type DenContextValue = DenState | null;

// ─── P2P adapter interface ────────────────────────────────────────────────────

/**
 * The subset of @meerkat/p2p that @meerkat/crdt depends on.
 *
 * Defined as an interface so @meerkat/p2p can be injected (or mocked in tests)
 * without creating a hard import-time dependency.  When @meerkat/p2p is not
 * yet installed the den operates in offline mode.
 */
export interface P2PAdapter {
  /**
   * Start hosting: begin listening for visitor connections via the
   * signaling channel. Returns a cleanup function.
   */
  hostDen(denId: string): () => void;

  /**
   * Returns the current connection status for a den.
   * Called once on mount; live updates come via onStatusChange.
   */
  getStatus(denId: string): SyncStatus;

  /**
   * Subscribe to status changes for a den.
   * Returns an unsubscribe function.
   */
  onStatusChange(
    denId: string,
    handler: (status: SyncStatus) => void,
  ): () => void;
}
