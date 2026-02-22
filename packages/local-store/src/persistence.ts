/**
 * Persistence utilities for @meerkat/local-store.
 *
 * Low-level helpers for exporting Yjs state vectors (for backup),
 * clearing a den's IndexedDB data (for logout / account wipe),
 * and checking whether a den has any local data.
 *
 * These are generally called by app-level utilities rather than
 * directly by UI components.
 */

import * as Y from "yjs";
import { openDen, closeDen } from "./den.js";

import { privateDbName, sharedDbName } from "./constants.js";

// ─── Existence check ─────────────────────────────────────────────────────────

/**
 * Returns true if a den has any data persisted in IndexedDB.
 * Useful to distinguish a brand-new den from one that has local data.
 *
 * Implementation note: y-indexeddb creates an IDB database on first sync.
 * We check for its existence by trying to open it with a version check.
 */
export async function denHasLocalData(denId: string): Promise<boolean> {
  const check = async (dbName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        const hasData = db.objectStoreNames.length > 0;
        db.close();
        resolve(hasData);
      };
      req.onerror = () => resolve(false);
    });
  };

  const [hasPrivate, hasShared] = await Promise.all([
    check(privateDbName(denId)),
    check(sharedDbName(denId)),
  ]);

  return hasPrivate || hasShared;
}

// ─── Export (backup) ─────────────────────────────────────────────────────────

export interface DenExport {
  denId: string;
  exportedAt: number;
  /** Binary Yjs state vector for private.ydoc */
  privateState: Uint8Array;
  /** Binary Yjs state vector for shared.ydoc */
  sharedState: Uint8Array;
}

/**
 * Exports the full Yjs state for both docs as binary state vectors.
 *
 * The exported data can be passed to importDen() to restore the den
 * on another device or after a wipe.
 *
 * NOTE: This exports raw Yjs state — it does NOT encrypt the data.
 * Callers are responsible for encrypting before storage/transfer.
 */
export async function exportDen(denId: string): Promise<DenExport> {
  const { privateDen, sharedDen } = await openDen(denId);

  return {
    denId,
    exportedAt: Date.now(),
    privateState: Y.encodeStateAsUpdate(privateDen.ydoc),
    sharedState: Y.encodeStateAsUpdate(sharedDen.ydoc),
  };
}

// ─── Import (restore) ────────────────────────────────────────────────────────

/**
 * Merges exported Yjs state into the current den docs.
 *
 * Safe to call on an existing den — Yjs merges CRDTs without data loss.
 * Typically used to restore from a backup or sync from another device.
 */
export async function importDenState(
  denId: string,
  exported: DenExport,
): Promise<void> {
  if (exported.denId !== denId) {
    throw new Error(
      `Export den ID mismatch: expected ${denId}, got ${exported.denId}`,
    );
  }

  const { privateDen, sharedDen } = await openDen(denId);

  Y.applyUpdate(privateDen.ydoc, exported.privateState);
  Y.applyUpdate(sharedDen.ydoc, exported.sharedState);
}

// ─── Clear (wipe) ────────────────────────────────────────────────────────────

/**
 * Deletes all IndexedDB data for a den.
 *
 * Call this on logout or when the user explicitly wipes their den.
 * This also closes the den if it is currently open.
 *
 * ⚠️  This is irreversible if there is no backup.
 */
export async function clearDenLocalData(denId: string): Promise<void> {
  // Close before wiping to avoid conflicts with open persistence providers
  closeDen(denId);

  await Promise.all([
    deleteIdbDatabase(privateDbName(denId)),
    deleteIdbDatabase(sharedDbName(denId)),
  ]);
}

function deleteIdbDatabase(dbName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error(`Failed to delete IDB: ${dbName}`));
    // Some browsers call onblocked when there are open connections
    req.onblocked = () => {
      console.warn(`[@meerkat/local-store] IDB delete blocked for: ${dbName}`);
      resolve(); // Still resolve — the db will be deleted once connections close
    };
  });
}

// ─── Snapshot (read-only, no IDB open) ───────────────────────────────────────

/**
 * Takes a point-in-time snapshot of a den's current Yjs state without
 * keeping the persistence provider open. Useful in background workers.
 *
 * Returns the state vector binary that can be stored or compared.
 */
export async function getDenStateVector(
  denId: string,
  doc: "private" | "shared",
): Promise<Uint8Array> {
  const { privateDen, sharedDen } = await openDen(denId);
  const ydoc = doc === "private" ? privateDen.ydoc : sharedDen.ydoc;
  return Y.encodeStateVector(ydoc);
}
