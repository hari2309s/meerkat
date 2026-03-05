/**
 * @meerkat/burrows — types
 *
 * A burrow is a named page within a den. Its content (blocks) is stored in a
 * separate Yjs document referenced by `yjsDocId` — managed by Tiptap's
 * Collaboration extension as a Y.XmlFragment.
 *
 * Burrow metadata (title, icon, ordering, etc.) is stored in the den's
 * burrows Y.Map so it is available without loading the full content doc.
 *
 * All timestamps are Unix milliseconds.
 */

// ─── Burrow (page) ────────────────────────────────────────────────────────────

/**
 * Burrow metadata record — stored in the den's `Y.Map<BurrowData>`.
 *
 * Content is NOT stored here. Use `useBurrowDoc(yjsDocId)` or
 * `openBurrowContentDoc(yjsDocId)` to get the Yjs doc that holds
 * the actual block content (a Y.XmlFragment used by Tiptap).
 */
export interface BurrowData {
  id: string;
  /** The den this burrow belongs to. */
  denId: string;
  title: string;
  /** Emoji or URL used as the page icon. */
  icon?: string;
  /**
   * ID of the separate Yjs document that holds this burrow's block content.
   * Matches the `guid` passed to `new Y.Doc({ guid })`.
   */
  yjsDocId: string;
  /** User ID of the member who created this burrow. */
  createdBy: string;
  /**
   * When true the burrow is soft-deleted (hidden from lists but not purged
   * from IndexedDB). Use `archiveBurrow` / `restoreBurrow`.
   */
  archived: boolean;
  /** User IDs of all members who have contributed content. */
  collaborators: string[];
  /** Fractional sort key for ordering burrows in the sidebar. */
  order: number;
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms
}

// ─── Burrow metadata (computed stats) ─────────────────────────────────────────

/**
 * Computed statistics for a burrow — derived from content by the editor.
 * Stored alongside `BurrowData` as a separate key in the den's metadata doc.
 */
export interface BurrowMetadata {
  wordCount: number;
  /** User ID of the last person to make an edit. */
  lastEditedBy: string | null;
  /** True if the content doc contains at least one voice block node. */
  hasVoiceNotes: boolean;
  /** True if the content doc contains at least one image block node. */
  hasImages: boolean;
}

// ─── Input types ─────────────────────────────────────────────────────────────

export type CreateBurrowInput = {
  denId: string;
  title: string;
  createdBy: string;
  icon?: string;
};

export type UpdateBurrowInput = Partial<
  Pick<BurrowData, "title" | "icon" | "collaborators" | "order">
>;
