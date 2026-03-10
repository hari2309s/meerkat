/**
 * @meerkat/burrows
 *
 * Block-based pages (burrows) for Meerkat dens. Each burrow is a named
 * page whose block content is stored in a dedicated Yjs document.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Den metadata doc  ("meerkat-burrows-{denId}")
 *     Y.Map<BurrowData>     — page list with title, icon, order, etc.
 *     Y.Map<BurrowMetadata> — computed stats (word count, voice notes, etc.)
 *
 *   Burrow content docs  ("meerkat-burrow-content-{yjsDocId}")
 *     Y.XmlFragment "default" — block content read/written by Tiptap
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Quick start
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   // List all pages in a den
 *   import { useBurrows } from '@meerkat/burrows';
 *
 *   function Sidebar({ denId, userId }) {
 *     const { burrows, actions } = useBurrows(denId);
 *     return (
 *       <>
 *         {burrows.map(b => <PageRow key={b.id} burrow={b} />)}
 *         <button onClick={() =>
 *           actions.createBurrow({ title: 'Untitled', createdBy: userId })
 *         }>
 *           + New page
 *         </button>
 *       </>
 *     );
 *   }
 *
 *   // Open a page for editing
 *   import { useBurrow, useBurrowDoc } from '@meerkat/burrows';
 *   import { BurrowEditor } from '@meerkat/editor';
 *
 *   function EditorPage({ denId, burrowId }) {
 *     const { burrow, actions } = useBurrow(denId, burrowId);
 *     const { doc } = useBurrowDoc(burrow?.yjsDocId);
 *
 *     if (!burrow || !doc) return <Spinner />;
 *
 *     return (
 *       <BurrowEditor
 *         doc={doc}
 *         user={{ name: currentUser.name, color: '#7c3aed' }}
 *         onTitleChange={(t) => actions.updateBurrow({ title: t })}
 *       />
 *     );
 *   }
 */

// ─── Doc lifecycle (imperative) ───────────────────────────────────────────────
export {
  openBurrowsDoc,
  closeBurrowsDoc,
  openBurrowContentDoc,
  closeBurrowContentDoc,
} from "./store.js";

// ─── Burrow CRUD (imperative) ─────────────────────────────────────────────────
export {
  createBurrow,
  getBurrow,
  getAllBurrows,
  getBurrowsByDen,
  updateBurrow,
  archiveBurrow,
  restoreBurrow,
  deleteBurrow,
  setCurrentBurrow,
  getCurrentBurrowId,
} from "./store.js";

// ─── Viewer tracking (imperative) ─────────────────────────────────────────────
export { addBurrowViewer } from "./store.js";

// ─── Metadata (imperative) ────────────────────────────────────────────────────
export { getBurrowMetadata, setBurrowMetadata } from "./store.js";

// ─── React hooks ─────────────────────────────────────────────────────────────
export { useBurrows, useBurrow, useBurrowDoc } from "./hooks.js";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  BurrowData,
  BurrowMetadata,
  CreateBurrowInput,
  UpdateBurrowInput,
  BurrowBlock,
  BurrowBlockType,
} from "./types.js";
