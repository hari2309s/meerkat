/**
 * @meerkat/crdt
 *
 * Orchestration layer for Meerkat's local-first data model.
 *
 * Wires @meerkat/local-store (IndexedDB + Yjs) and @meerkat/p2p (WebRTC)
 * together into a unified API. Manages the sync state machine
 * (offline → connecting → synced → hosting).
 *
 * The app imports from this package — never directly from @meerkat/local-store
 * or @meerkat/p2p.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Quick start
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   // Page layout (recommended pattern):
 *   import { DenProvider } from '@meerkat/crdt';
 *
 *   export default function DenLayout({ params, children }) {
 *     return <DenProvider denId={params.denId}>{children}</DenProvider>;
 *   }
 *
 *   // Any component inside the provider:
 *   import { useDenContext } from '@meerkat/crdt';
 *
 *   function NoteList() {
 *     const { notes, syncStatus, actions } = useDenContext();
 *     return notes.map(n => <NoteCard key={n.id} note={n} />);
 *   }
 *
 *   // Or without a provider (standalone mode):
 *   import { useDen } from '@meerkat/crdt';
 *
 *   function Widget({ denId }) {
 *     const { notes } = useDen(denId);
 *     return <NoteCount count={notes.length} />;
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What was removed from the old @meerkat/crdt
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ✗  legacy subscription setup — REMOVED
 *   ✗  useDenMessages() querying Supabase              — REMOVED
 *   ✗  useDenPresence() via Supabase Presence          — REMOVED
 *   ✗  useYDoc() thin wrapper with untyped Y.Doc       — REMOVED
 *
 * See src/migration-notes.ts for the full before/after for den-page-client.tsx.
 */

// ─── Primary hook ─────────────────────────────────────────────────────────────
export { useDen } from "./use-den.js";

// ─── Context (DenProvider pattern) ────────────────────────────────────────────
export { DenProvider, useDenContext, useDenContextSafe } from "./context.js";

// ─── Sync machine (advanced / testing) ────────────────────────────────────────
export {
  DenSyncMachine,
  getOrCreateMachine,
  destroyMachine,
  resetAllMachines,
} from "./sync-machine.js";

// ─── P2P adapter (advanced / testing) ────────────────────────────────────────
export {
  offlineAdapter,
  resolveP2PAdapter,
  getAdapterSync,
  setP2PAdapter,
  resetP2PAdapter,
} from "./p2p-adapter.js";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SyncStatus,
  DenState,
  DenActions,
  SharedDenView,
  DenContextValue,
  P2PAdapter,
} from "./types.js";

// ─── Re-export the local-store types the app needs ───────────────────────────
// The app should import content types from @meerkat/crdt, not local-store,
// so this is the single import point for everything den-related.
export type {
  NoteData,
  VoiceMemoData,
  MoodEntry,
  DropboxItem,
  PresenceInfo,
  CreateNoteInput,
  UpdateNoteInput,
  SearchNotesOptions,
} from "@meerkat/local-store";
