/**
 * @meerkat/burrows — Yjs store
 *
 * Two types of Yjs documents are managed here:
 *
 *   1. Den metadata doc  ("meerkat-burrows-{denId}")
 *      Y.Map<BurrowData>  — one entry per burrow page (metadata only, no content)
 *      Y.Map<BurrowMetadata> — word counts and stats per burrow
 *
 *   2. Burrow content docs  ("meerkat-burrow-content-{yjsDocId}")
 *      A Y.XmlFragment named "default" — this is what Tiptap's Collaboration
 *      extension writes to. Opened lazily via openBurrowContentDoc().
 *
 * All writes go through Yjs transactions so they are automatically
 * persisted to IndexedDB and propagate to peers when P2P is active.
 */

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type {
  BurrowData,
  BurrowMetadata,
  CreateBurrowInput,
  UpdateBurrowInput,
} from "./types.js";

// ─── Internal handles ─────────────────────────────────────────────────────────

interface DenMetaDoc {
  readonly ydoc: Y.Doc;
  readonly burrows: Y.Map<BurrowData>;
  readonly metadata: Y.Map<BurrowMetadata>;
  destroy(): void;
}

interface BurrowContentDoc {
  readonly ydoc: Y.Doc;
  /** The Y.XmlFragment Tiptap's Collaboration extension reads/writes. */
  readonly fragment: Y.XmlFragment;
  destroy(): void;
}

const IDB_META_PREFIX = "meerkat-burrows";
const IDB_CONTENT_PREFIX = "meerkat-burrow-content";

const openMetaDocs = new Map<string, DenMetaDoc>();
const openContentDocs = new Map<string, BurrowContentDoc>();

/** In-memory tracker for the currently-active burrow per den. */
const activeBurrowId = new Map<string, string | null>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function metaDbName(denId: string): string {
  return `${IDB_META_PREFIX}-${denId}`;
}

function contentDbName(yjsDocId: string): string {
  return `${IDB_CONTENT_PREFIX}-${yjsDocId}`;
}

// ─── Den metadata doc lifecycle ──────────────────────────────────────────────

/**
 * Opens (or returns the cached) den metadata doc.
 * This doc holds the list of burrows (titles, icons, ordering, etc.) but NOT
 * their content. Content lives in per-burrow docs via `openBurrowContentDoc`.
 */
export async function openBurrowsDoc(denId: string): Promise<DenMetaDoc> {
  const cached = openMetaDocs.get(denId);
  if (cached) return cached;

  const ydoc = new Y.Doc({ guid: `burrows-meta-${denId}` });
  const persistence = new IndexeddbPersistence(metaDbName(denId), ydoc);
  await persistence.whenSynced;

  const burrows = ydoc.getMap<BurrowData>("burrows");
  const metadata = ydoc.getMap<BurrowMetadata>("metadata");

  const doc: DenMetaDoc = {
    ydoc,
    burrows,
    metadata,
    destroy() {
      persistence.destroy();
      ydoc.destroy();
    },
  };

  openMetaDocs.set(denId, doc);
  return doc;
}

/**
 * Closes the den metadata doc and removes it from the in-memory cache.
 */
export function closeBurrowsDoc(denId: string): void {
  const doc = openMetaDocs.get(denId);
  if (!doc) return;
  doc.destroy();
  openMetaDocs.delete(denId);
}

// ─── Burrow content doc lifecycle ─────────────────────────────────────────────

/**
 * Opens (or returns the cached) content doc for a burrow.
 *
 * The content doc contains a single `Y.XmlFragment` named "default" which
 * is what `@tiptap/extension-collaboration` reads from and writes to.
 *
 * @example
 * ```ts
 * const { ydoc, fragment } = await openBurrowContentDoc(burrow.yjsDocId);
 * // Pass ydoc to BurrowEditor as the `doc` prop
 * ```
 */
export async function openBurrowContentDoc(
  yjsDocId: string,
): Promise<BurrowContentDoc> {
  const cached = openContentDocs.get(yjsDocId);
  if (cached) return cached;

  const ydoc = new Y.Doc({ guid: yjsDocId });
  const persistence = new IndexeddbPersistence(contentDbName(yjsDocId), ydoc);
  await persistence.whenSynced;

  // "default" is the fragment name Tiptap's Collaboration extension uses
  const fragment = ydoc.getXmlFragment("default");

  const contentDoc: BurrowContentDoc = {
    ydoc,
    fragment,
    destroy() {
      persistence.destroy();
      ydoc.destroy();
    },
  };

  openContentDocs.set(yjsDocId, contentDoc);
  return contentDoc;
}

/**
 * Closes a burrow's content doc and removes it from the in-memory cache.
 */
export function closeBurrowContentDoc(yjsDocId: string): void {
  const doc = openContentDocs.get(yjsDocId);
  if (!doc) return;
  doc.destroy();
  openContentDocs.delete(yjsDocId);
}

// ─── Burrow CRUD ──────────────────────────────────────────────────────────────

/**
 * Creates a new burrow in the den. A fresh content doc is also prepared
 * (an empty Y.XmlFragment in IndexedDB, ready for the editor).
 *
 * @example
 * ```ts
 * const burrow = await createBurrow({
 *   denId, title: 'Meeting Notes', createdBy: userId
 * });
 * ```
 */
export async function createBurrow(
  input: CreateBurrowInput,
): Promise<BurrowData> {
  const { burrows, ydoc } = await openBurrowsDoc(input.denId);

  const existing = Array.from(burrows.values());
  const maxOrder = existing.reduce((m, b) => Math.max(m, b.order), 0);

  const burrow: BurrowData = {
    id: generateId(),
    denId: input.denId,
    title: input.title,
    yjsDocId: generateId(), // separate ID for the content doc
    createdBy: input.createdBy,
    archived: false,
    collaborators: [input.createdBy],
    order: maxOrder + 1000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
  };

  ydoc.transact(() => {
    burrows.set(burrow.id, burrow);
  });

  // Pre-open the content doc so IndexedDB entry is initialised
  await openBurrowContentDoc(burrow.yjsDocId);

  return burrow;
}

/**
 * Returns a single burrow by ID, or undefined.
 */
export async function getBurrow(
  denId: string,
  burrowId: string,
): Promise<BurrowData | undefined> {
  const { burrows } = await openBurrowsDoc(denId);
  return burrows.get(burrowId);
}

/**
 * Returns all non-archived burrows for a den, sorted by `order`.
 */
export async function getAllBurrows(denId: string): Promise<BurrowData[]> {
  const { burrows } = await openBurrowsDoc(denId);
  return Array.from(burrows.values())
    .filter((b) => !b.archived)
    .sort((a, b) => a.order - b.order);
}

/**
 * Alias for `getAllBurrows` — matches the doc's API naming.
 */
export const getBurrowsByDen = getAllBurrows;

/**
 * Updates a burrow's metadata fields (title, icon, order, etc.).
 *
 * @throws {Error} if the burrow is not found.
 */
export async function updateBurrow(
  denId: string,
  burrowId: string,
  input: UpdateBurrowInput,
): Promise<BurrowData> {
  const { burrows, ydoc } = await openBurrowsDoc(denId);

  const existing = burrows.get(burrowId);
  if (!existing) throw new Error(`Burrow not found: ${burrowId}`);

  const updated: BurrowData = {
    ...existing,
    ...input,
    updatedAt: Date.now(),
  };

  ydoc.transact(() => {
    burrows.set(burrowId, updated);
  });

  return updated;
}

/**
 * Soft-deletes a burrow by setting `archived: true`.
 * The content doc is preserved in IndexedDB.
 *
 * @throws {Error} if the burrow is not found.
 */
export async function archiveBurrow(
  denId: string,
  burrowId: string,
): Promise<void> {
  const { burrows, ydoc } = await openBurrowsDoc(denId);

  const existing = burrows.get(burrowId);
  if (!existing) throw new Error(`Burrow not found: ${burrowId}`);

  ydoc.transact(() => {
    burrows.set(burrowId, {
      ...existing,
      archived: true,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Restores an archived burrow.
 *
 * @throws {Error} if the burrow is not found.
 */
export async function restoreBurrow(
  denId: string,
  burrowId: string,
): Promise<void> {
  const { burrows, ydoc } = await openBurrowsDoc(denId);

  const existing = burrows.get(burrowId);
  if (!existing) throw new Error(`Burrow not found: ${burrowId}`);

  ydoc.transact(() => {
    burrows.set(burrowId, {
      ...existing,
      archived: false,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Permanently deletes a burrow and its content doc from the in-memory cache.
 * (IndexedDB is not explicitly cleared — that would require clearing IDB.)
 *
 * @throws {Error} if the burrow is not found.
 */
export async function deleteBurrow(
  denId: string,
  burrowId: string,
): Promise<void> {
  const { burrows, ydoc } = await openBurrowsDoc(denId);

  const existing = burrows.get(burrowId);
  if (!existing) throw new Error(`Burrow not found: ${burrowId}`);

  closeBurrowContentDoc(existing.yjsDocId);

  ydoc.transact(() => {
    burrows.delete(burrowId);
  });
}

// ─── Active burrow tracking ───────────────────────────────────────────────────

/**
 * Sets the currently-active (focused) burrow for a den.
 * This is in-memory only — it is reset when the page reloads.
 */
export function setCurrentBurrow(
  denId: string,
  burrowId: string | null,
): void {
  activeBurrowId.set(denId, burrowId);
}

/**
 * Returns the currently-active burrow ID for a den, or null.
 */
export function getCurrentBurrowId(denId: string): string | null {
  return activeBurrowId.get(denId) ?? null;
}

// ─── Burrow metadata (word counts, etc.) ─────────────────────────────────────

/**
 * Returns the computed metadata for a burrow (word count, etc.).
 */
export async function getBurrowMetadata(
  denId: string,
  burrowId: string,
): Promise<BurrowMetadata | undefined> {
  const { metadata } = await openBurrowsDoc(denId);
  return metadata.get(burrowId);
}

/**
 * Stores computed metadata for a burrow. Called by the editor on update.
 */
export async function setBurrowMetadata(
  denId: string,
  burrowId: string,
  meta: BurrowMetadata,
): Promise<void> {
  const { metadata, ydoc } = await openBurrowsDoc(denId);
  ydoc.transact(() => {
    metadata.set(burrowId, meta);
  });
}
