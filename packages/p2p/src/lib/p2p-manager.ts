// ─── p2p-manager.ts ──────────────────────────────────────────────────────────
//
// The central P2P manager. This is the singleton that @meerkat/crdt imports
// via dynamic import and uses as its P2PAdapter.
//
// @meerkat/crdt calls:
//   createP2PAdapter()     — get the adapter singleton
//   adapter.hostDen(id)    — start hosting; returns cleanup fn
//   adapter.getStatus(id)  — current SyncStatus for a den
//   adapter.onStatusChange — subscribe to status events
//
// Everything else (joinDen, visitor management, offline drops) is exposed
// as higher-level API for React hooks in hooks.ts.
//
// Design: one HostManager per den, created lazily and cached. The manager
// is only allocated when hostDen() is called. Visiting another den creates
// a VisitorConnection, which is NOT tracked here (it's tracked in useJoinDen).

import { HostManager } from "./host-manager";
import type {
  P2PAdapter,
  P2PManagerOptions,
  SyncStatus,
  VisitorSession,
} from "../types";

// ─── P2PManager ──────────────────────────────────────────────────────────────

/**
 * Manages all P2P sessions across dens.
 *
 * One instance per app. Created via createP2PManager() and exposed via the
 * P2PAdapter interface to @meerkat/crdt.
 */
export class P2PManager {
  private readonly options: P2PManagerOptions;

  // Per-den host managers, lazily created
  private hostManagers = new Map<string, HostManager>();

  // Per-den host public key (set by the app before hosting)
  private hostPublicKey = "";

  constructor(options: P2PManagerOptions) {
    this.options = options;
  }

  // ── P2PAdapter interface (called by @meerkat/crdt) ───────────────────────

  /**
   * Start hosting a den. Creates a HostManager for the den if needed,
   * subscribes to the signaling channel, and begins accepting visitors.
   * Returns a cleanup function that stops hosting.
   */
  hostDen(denId: string): () => void {
    let manager = this.hostManagers.get(denId);

    if (!manager) {
      manager = new HostManager(denId, this.options);
      this.hostManagers.set(denId, manager);
    }

    let stopPromise: Promise<() => void> | null = null;

    // Start asynchronously — hostDen must be synchronous per the P2PAdapter
    // contract, so we fire-and-forget but capture the stop function
    let stopFn: (() => void) | null = null;

    console.log(`[@meerkat/p2p] Starting hosting for den ${denId}...`);

    stopPromise = manager
      .start(this.hostPublicKey)
      .then((stop) => {
        console.log(
          `[@meerkat/p2p] ✅ Hosting started successfully for den ${denId}`,
        );
        stopFn = stop;
        return stop;
      })
      .catch((err) => {
        console.error(
          `[@meerkat/p2p] ❌ Failed to start hosting den ${denId}:`,
          err,
        );
        console.error(`[@meerkat/p2p] Error details:`, err.stack || err);
        return () => {};
      });

    // Return a synchronous cleanup that waits for start before stopping
    return () => {
      if (stopFn) {
        stopFn();
      } else {
        // Start hasn't resolved yet — stop when it does
        stopPromise?.then((stop) => stop()).catch(() => {});
      }
      this.hostManagers.delete(denId);
    };
  }

  getStatus(denId: string): SyncStatus {
    return this.hostManagers.get(denId)?.status ?? "offline";
  }

  onStatusChange(
    denId: string,
    handler: (status: SyncStatus) => void,
  ): () => void {
    const manager = this.hostManagers.get(denId);
    if (!manager) {
      // Not hosting this den — status is always offline; never changes
      return () => {};
    }
    return manager.onStatusChange(handler);
  }

  // ── Extended API (used by React hooks) ───────────────────────────────────

  /**
   * Returns the active HostManager for a den (if hosting).
   * Used by useVisitorPresence and useHostStatus hooks.
   */
  getHostManager(denId: string): HostManager | undefined {
    return this.hostManagers.get(denId);
  }

  /**
   * Returns live visitor sessions for a den.
   */
  getVisitorSessions(denId: string): VisitorSession[] {
    return this.hostManagers.get(denId)?.visitorSessions ?? [];
  }

  /**
   * Disconnect a specific visitor from a den.
   */
  async disconnectVisitor(denId: string, visitorId: string): Promise<void> {
    await this.hostManagers.get(denId)?.disconnectVisitor(visitorId);
  }

  /**
   * Set the host's public key (for identity verification by visitors).
   * Call this after the host's keypair is loaded from private.ydoc settings.
   */
  setHostPublicKey(key: string): void {
    this.hostPublicKey = key;
  }

  /**
   * Stop hosting all dens and clean up.
   * Called on logout or app teardown.
   */
  async stopAll(): Promise<void> {
    for (const [denId, manager] of this.hostManagers) {
      await manager.stop();
      this.hostManagers.delete(denId);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let globalManager: P2PManager | null = null;

/**
 * Initialize the global P2P manager with caller-provided options.
 *
 * Call this once at app startup (e.g. in a layout component) before any
 * P2P activity. The caller provides the signaling channel factory (e.g. from
 * their host) so the package core has no hard dependency on any one provider.
 *
 * @example
 * ```ts
 * // In a layout component:
 * import { initP2P } from '@meerkat/p2p'
 *
 * initP2P({
 *   createSignalingChannel: (name) => mySignalingProvider.channel(name),
 * })
 * ```
 */
export function initP2P(options: P2PManagerOptions): P2PManager {
  globalManager = new P2PManager(options);
  return globalManager;
}

/**
 * Returns the global P2P manager. Throws if initP2P() has not been called.
 */
export function getP2PManager(): P2PManager {
  if (!globalManager) {
    throw new Error(
      "[@meerkat/p2p] P2P manager not initialized. Call initP2P() first.",
    );
  }
  return globalManager;
}

/**
 * The entry point called by @meerkat/crdt's dynamic import:
 *
 *   const p2pModule = await import('@meerkat/p2p')
 *   const adapter = p2pModule.createP2PAdapter()
 *
 * Returns the global manager as a P2PAdapter if it has been initialized,
 * otherwise throws. The crdt package falls back to offlineAdapter on throw.
 */
export function createP2PAdapter(): P2PAdapter {
  return getP2PManager();
}

/**
 * Reset the global manager — used in tests.
 */
export function resetP2PManager(): void {
  globalManager?.stopAll().catch(() => {});
  globalManager = null;
}
