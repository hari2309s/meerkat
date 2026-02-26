/**
 * @meerkat/crdt — P2P adapter loader
 *
 * @meerkat/p2p is an optional peer dependency (Phase 4). Before it exists,
 * or in environments where WebRTC is unavailable, the den operates in
 * 'offline' mode transparently — all local content still works perfectly.
 *
 * This module provides:
 *   - A no-op adapter for when @meerkat/p2p is absent
 *   - A dynamic import that activates the real adapter once the package ships
 *   - A stable singleton so we don't re-import on every render
 */

import type { P2PAdapter, SyncStatus } from "./types.js";

// ─── No-op (offline-only) adapter ────────────────────────────────────────────

/**
 * Used when @meerkat/p2p is not installed or WebRTC is unavailable.
 * The den is fully functional for local reads and writes; no sync occurs.
 */
export const offlineAdapter: P2PAdapter = {
  hostDen(_denId: string): () => void {
    // Nothing to do — P2P not available
    return () => {
      /* no-op cleanup */
    };
  },

  getStatus(_denId: string): SyncStatus {
    return "offline";
  },

  onStatusChange(
    _denId: string,
    _handler: (status: SyncStatus) => void,
  ): () => void {
    // No status changes will ever fire
    return () => {
      /* no-op unsubscribe */
    };
  },
};

// ─── Adapter cache ────────────────────────────────────────────────────────────

let resolvedAdapter: P2PAdapter | null = null;
let adapterLoadAttempted = false;

/**
 * Returns the best available P2P adapter.
 *
 * On Phase 4+ installations where @meerkat/p2p is present, this returns
 * the real adapter (loaded once and cached). Otherwise returns the no-op
 * offline adapter.
 *
 * This is an async function because dynamic import() is async, but after the
 * first call it resolves instantly from cache.
 */
export async function resolveP2PAdapter(): Promise<P2PAdapter> {
  if (resolvedAdapter) return resolvedAdapter;

  if (!adapterLoadAttempted) {
    try {
      // Dynamic import — will throw if @meerkat/p2p is not installed
      const p2pModule = await import("@meerkat/p2p");

      // @meerkat/p2p must export createP2PAdapter() that returns a P2PAdapter
      if (typeof p2pModule.createP2PAdapter === "function") {
        try {
          resolvedAdapter = p2pModule.createP2PAdapter() as P2PAdapter;
          adapterLoadAttempted = true; // Successfully resolved the real adapter
        } catch (err) {
          // Manager not initialized yet? Don't mark as attempted so we can retry
          if (err instanceof Error && err.message.includes("not initialized")) {
            return offlineAdapter;
          }
          // Some other error — fall back and cache it as offline
          resolvedAdapter = offlineAdapter;
          adapterLoadAttempted = true;
        }
      } else {
        resolvedAdapter = offlineAdapter;
        adapterLoadAttempted = true;
      }
    } catch {
      // @meerkat/p2p not installed — Phase 1/2/3 mode
      resolvedAdapter = offlineAdapter;
      adapterLoadAttempted = true;
    }
  }

  return resolvedAdapter ?? offlineAdapter;
}

/**
 * Synchronously returns the adapter if already resolved, otherwise the
 * offline fallback. Used in places that can't await (e.g. initial render).
 */
export function getAdapterSync(): P2PAdapter {
  return resolvedAdapter ?? offlineAdapter;
}

/**
 * Overrides the adapter — used in tests and Storybook to inject mocks.
 *
 * @example
 * ```ts
 * setP2PAdapter(mockAdapter);
 * ```
 */
export function setP2PAdapter(adapter: P2PAdapter): void {
  resolvedAdapter = adapter;
  adapterLoadAttempted = true;
}

/**
 * Resets the adapter cache — use in tests between test cases.
 */
export function resetP2PAdapter(): void {
  resolvedAdapter = null;
  adapterLoadAttempted = false;
}
