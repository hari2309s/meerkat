/**
 * @meerkat/editor
 *
 * Block-based page editor powered by Tiptap + Yjs collaboration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Quick start
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import '@meerkat/editor/editor.css';  // once, in your app root
 *   import { BurrowEditor } from '@meerkat/editor';
 *   import { useBurrow, useBurrowDoc } from '@meerkat/burrows';
 *
 *   function EditorPage({ denId, burrowId }) {
 *     const { burrow, actions } = useBurrow(denId, burrowId);
 *     const { doc, isLoading } = useBurrowDoc(burrow?.yjsDocId);
 *
 *     if (isLoading || !doc) return <Spinner />;
 *
 *     return (
 *       <BurrowEditor
 *         doc={doc}
 *         user={{ name: 'Alice', color: '#7c3aed' }}
 *         title={burrow.title}
 *         icon={burrow.icon}
 *         onTitleChange={(t) => actions.updateBurrow({ title: t })}
 *         onUpdate={({ wordCount, hasVoiceNotes, hasImages }) =>
 *           setBurrowMetadata(denId, burrowId, {
 *             wordCount, hasVoiceNotes, hasImages, lastEditedBy: userId
 *           })
 *         }
 *       />
 *     );
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Slash commands  (type "/" to trigger)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Text · Heading 1-3 · Bullet list · Numbered list · To-do list
 *   Quote · Code block · Divider · Image · Voice note
 */

// ─── Primary component ────────────────────────────────────────────────────────
export {
  BurrowEditor,
  type BurrowEditorProps,
  type CollaborationProvider,
  type EditorUser,
} from "./block-editor.js";

// ─── Tiptap extensions (for custom editor setups) ─────────────────────────────
export {
  VoiceBlock,
  createVoiceBlockExtension,
  type VoiceBlockAttrs,
} from "./extensions/voice-block.js";
export { ImageBlock } from "./extensions/image-block.js";
export {
  createSlashCommandsExtension,
  buildSlashItems,
  filterSlashItems,
  type SlashCommandItem,
} from "./extensions/slash-commands.js";

// ─── Slash menu UI (for custom renderers) ─────────────────────────────────────
export {
  SlashMenu,
  createSlashMenuRenderer,
  type SlashMenuProps,
  type SlashMenuHandle,
} from "./slash-menu.js";
