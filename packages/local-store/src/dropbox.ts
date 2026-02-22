/**
 * Dropbox operations for @meerkat/local-store.
 *
 * The dropbox namespace in shared.ydoc is a write-only channel for visitors.
 * Visitors with a "Letterbox" capability key can push encrypted items here
 * even when the host is offline (via a fallback Supabase Storage path,
 * handled by @meerkat/p2p). The host reads and decrypts drops.
 *
 * This module owns the data layer. Transport is handled by @meerkat/p2p.
 */

import { openDen } from "./den.js";
import type { DropboxItem } from "./types.js";

function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Adds an item to the den's shared dropbox.
 *
 * Intended for visitor use — the payload should be encrypted with the
 * host's public key before calling this function (see @meerkat/crypto).
 *
 * @param denId           — The den to drop into.
 * @param visitorId       — Ephemeral visitor identity.
 * @param encryptedPayload — The encrypted drop contents.
 *
 * @example
 * ```ts
 * const encrypted = await encryptBundle(payload, hostPublicKey);
 * await addToDropbox(hostDenId, myVisitorId, encrypted);
 * ```
 */
export async function addToDropbox(
  denId: string,
  visitorId: string,
  encryptedPayload: Uint8Array | string,
): Promise<DropboxItem> {
  const { sharedDen } = await openDen(denId);

  const item: DropboxItem = {
    id: generateId(),
    visitorId,
    encryptedPayload,
    droppedAt: Date.now(),
  };

  sharedDen.ydoc.transact(() => {
    sharedDen.dropbox.push([item]);
  });

  return item;
}

/**
 * Returns all items in the dropbox, oldest-first.
 * Only the host should call this — visitors should only call addToDropbox.
 */
export async function getDropboxItems(denId: string): Promise<DropboxItem[]> {
  const { sharedDen } = await openDen(denId);
  return sharedDen.dropbox.toArray();
}

/**
 * Clears all items from the dropbox once the host has read them.
 * This does not permanently delete from Yjs history — the tombstones remain.
 */
export async function clearDropbox(denId: string): Promise<void> {
  const { sharedDen } = await openDen(denId);
  const len = sharedDen.dropbox.length;
  if (len === 0) return;

  sharedDen.ydoc.transact(() => {
    sharedDen.dropbox.delete(0, len);
  });
}

/**
 * Removes a single dropbox item by ID.
 * Useful when processing drops one at a time.
 *
 * @throws {Error} if the item is not found.
 */
export async function deleteDropboxItem(
  denId: string,
  itemId: string,
): Promise<void> {
  const { sharedDen } = await openDen(denId);
  const items = sharedDen.dropbox.toArray();
  const idx = items.findIndex((i) => i.id === itemId);

  if (idx === -1) {
    throw new Error(`Dropbox item not found: ${itemId}`);
  }

  sharedDen.ydoc.transact(() => {
    sharedDen.dropbox.delete(idx, 1);
  });
}
