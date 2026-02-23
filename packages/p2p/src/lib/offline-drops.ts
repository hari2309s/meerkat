// ─── offline-drops.ts ────────────────────────────────────────────────────────
//
// Offline drop support for Letterbox keys.
//
// When the host is offline, a visitor with a Letterbox DenKey can't open a
// WebRTC connection. Instead they upload an encrypted drop to Supabase Storage
// under a well-known path: drops/{denId}/{dropId}.enc
//
// When the host comes back online, @meerkat/p2p checks for pending drops under
// their den's storage prefix and imports them into shared.ydoc's dropbox
// namespace (via @meerkat/local-store addToDropbox).
//
// The drop payload is encrypted using the dropbox namespace key from the
// visitor's DenKey (from @meerkat/crypto encryptBlob). The host decrypts it
// using their own copy of the same dropbox key.
//
// Storage path structure:
//   drops/{denId}/{visitorId}-{dropId}.enc
//
// Why Supabase Storage and not Realtime?
//   Realtime is ephemeral — messages are lost if the host isn't connected.
//   Storage persists until explicitly deleted by the host.

import type { OfflineDrop } from "../types";

// ─── Drop path helpers ────────────────────────────────────────────────────────

export function dropStoragePath(
  denId: string,
  visitorId: string,
  dropId: string,
): string {
  return `drops/${denId}/${visitorId}-${dropId}.enc`;
}

export function dropStoragePrefix(denId: string): string {
  return `drops/${denId}/`;
}

// ─── OfflineDropManager ───────────────────────────────────────────────────────

/**
 * Options for the OfflineDropManager.
 * All storage interactions are caller-provided — this package has no direct
 * Supabase Storage dependency in its core logic.
 */
export interface OfflineDropManagerOptions {
  /**
   * Upload encrypted drop bytes to storage.
   * Returns the storage path.
   */
  uploadDrop: (
    path: string,
    data: Uint8Array,
    metadata: { iv: string; visitorId: string; droppedAt: string },
  ) => Promise<void>;

  /**
   * List drop files for a given den prefix.
   * Returns an array of storage paths.
   */
  listDrops: (prefix: string) => Promise<string[]>;

  /**
   * Download a single drop file.
   * Returns the raw bytes.
   */
  downloadDrop: (path: string) => Promise<{
    data: Uint8Array;
    metadata: { iv: string; visitorId: string; droppedAt: string };
  }>;

  /**
   * Delete a drop file after the host has imported it.
   */
  deleteDrop: (path: string) => Promise<void>;
}

/**
 * Handles the async Letterbox drop path.
 *
 * VISITOR SIDE:
 *   const mgr = new OfflineDropManager(options)
 *   await mgr.uploadDrop(denId, visitorId, encryptedPayload, iv)
 *
 * HOST SIDE (on reconnect):
 *   const pending = await mgr.collectPendingDrops(denId)
 *   for (const drop of pending) {
 *     await addToDropbox(denId, drop.visitorId, drop.encryptedPayload)
 *     await mgr.confirmDrop(drop)
 *   }
 */
export class OfflineDropManager {
  private readonly opts: OfflineDropManagerOptions;

  constructor(opts: OfflineDropManagerOptions) {
    this.opts = opts;
  }

  // ── Visitor side ──────────────────────────────────────────────────────────

  /**
   * Upload an encrypted drop to Supabase Storage for async delivery.
   *
   * @param denId            — The host's den ID
   * @param visitorId        — Ephemeral visitor identity
   * @param encryptedPayload — AES-GCM ciphertext bytes (from @meerkat/crypto encryptBlob)
   * @param iv               — Base64-encoded IV (from EncryptedBlob.iv)
   */
  async uploadDrop(
    denId: string,
    visitorId: string,
    encryptedPayload: Uint8Array,
    iv: string,
  ): Promise<OfflineDrop> {
    const dropId = generateDropId();
    const path = dropStoragePath(denId, visitorId, dropId);
    const droppedAt = new Date().toISOString();

    await this.opts.uploadDrop(path, encryptedPayload, {
      iv,
      visitorId,
      droppedAt,
    });

    return {
      dropId,
      denId,
      visitorId,
      encryptedPayload: uint8ArrayToBase64(encryptedPayload),
      iv,
      droppedAt,
    };
  }

  // ── Host side ─────────────────────────────────────────────────────────────

  /**
   * List and download all pending drops for a den.
   * Called by the host when coming online.
   */
  async collectPendingDrops(denId: string): Promise<OfflineDrop[]> {
    const prefix = dropStoragePrefix(denId);
    let paths: string[];

    try {
      paths = await this.opts.listDrops(prefix);
    } catch {
      // No drops bucket or listing failed — not an error
      return [];
    }

    const drops: OfflineDrop[] = [];

    for (const path of paths) {
      try {
        const { data, metadata } = await this.opts.downloadDrop(path);
        // Extract visitorId and dropId from path: drops/{denId}/{visitorId}-{dropId}.enc
        const filename = path.split("/").pop() ?? "";
        const withoutExt = filename.replace(/\.enc$/, "");
        const dashIdx = withoutExt.lastIndexOf("-");
        const visitorId =
          dashIdx > 0 ? withoutExt.slice(0, dashIdx) : withoutExt;

        drops.push({
          dropId: path, // use path as ID for deletion
          denId,
          visitorId: metadata.visitorId || visitorId,
          encryptedPayload: uint8ArrayToBase64(data),
          iv: metadata.iv,
          droppedAt: metadata.droppedAt,
        });
      } catch (err) {
        console.warn(`[@meerkat/p2p] Failed to download drop ${path}:`, err);
      }
    }

    return drops;
  }

  /**
   * Delete a drop from storage after the host has imported it.
   */
  async confirmDrop(drop: OfflineDrop): Promise<void> {
    const path = drop.dropId.startsWith("drops/")
      ? drop.dropId // already a path
      : dropStoragePath(drop.denId, drop.visitorId, drop.dropId);

    await this.opts.deleteDrop(path);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateDropId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]!);
  }
  return btoa(binary);
}
