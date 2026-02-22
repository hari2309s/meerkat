/**
 * @meerkat/local-store
 *
 * Local-first storage layer for Meerkat. Owns the two Yjs documents
 * (private.ydoc + shared.ydoc), persists them to IndexedDB via
 * y-indexeddb, and provides React hooks and imperative functions for
 * all content types.
 *
 * All reads in the app should go through this package — never directly
 * to Supabase for content.
 *
 * Architecture
 * ────────────
 *
 *   private.ydoc  — notes, voiceMemos, moodJournal, settings
 *                   Persisted to IndexedDB only. Never leaves the device.
 *
 *   shared.ydoc   — sharedNotes, voiceThread, dropbox, presence
 *                   Persisted to IndexedDB. Served to visitors over
 *                   WebRTC (by @meerkat/p2p) scoped by capability key.
 *
 * Usage
 * ─────
 *
 *   // Imperative (server components, background work, tests)
 *   const { privateDen, sharedDen } = await openDen(userId);
 *   const note = await createNote(userId, { content: 'Hello' });
 *
 *   // Reactive (React components)
 *   const notes = useAllNotes(userId);
 *   const note  = useNote(userId, noteId);
 */

// ─── Den lifecycle ────────────────────────────────────────────────────────────
export { openDen, closeDen, isDenOpen } from "./den.js";

// ─── Note operations ──────────────────────────────────────────────────────────
export {
  createNote,
  getNote,
  getAllNotes,
  searchNotes,
  updateNote,
  deleteNote,
} from "./notes.js";

// ─── Voice memo operations ───────────────────────────────────────────────────
export {
  addVoiceMemo,
  getAllVoiceMemos,
  getVoiceMemo,
  attachAnalysis,
  getMoodJournal,
} from "./voice-memos.js";

// ─── Dropbox operations ───────────────────────────────────────────────────────
export {
  addToDropbox,
  getDropboxItems,
  clearDropbox,
  deleteDropboxItem,
} from "./dropbox.js";

// ─── Settings operations ──────────────────────────────────────────────────────
export {
  getSetting,
  setSetting,
  deleteSetting,
  getAllSettings,
} from "./settings.js";

// ─── Persistence / backup utilities ──────────────────────────────────────────
export {
  denHasLocalData,
  exportDen,
  importDenState,
  clearDenLocalData,
  getDenStateVector,
} from "./persistence.js";

// ─── React hooks ─────────────────────────────────────────────────────────────
export {
  useDen,
  useNote,
  useAllNotes,
  useSharedNotes,
  useVoiceMemo,
  useAllVoiceMemos,
  useMoodJournal,
  useDropbox,
  usePresence,
  useSetting,
  useSetSetting,
} from "./hooks.js";

// ─── Types (re-exported for consumers) ───────────────────────────────────────
export type {
  DenDocs,
  PrivateDenDoc,
  SharedDenDoc,
  NoteData,
  VoiceMemoData,
  MoodEntry,
  DropboxItem,
  PresenceInfo,
  CreateNoteInput,
  UpdateNoteInput,
  SearchNotesOptions,
  DenStatus,
  DenEvent,
} from "./types.js";
