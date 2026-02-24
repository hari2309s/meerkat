/**
 * Type declarations for the optional @meerkat/p2p module.
 *
 * @meerkat/p2p is an optional peer dependency. When it's not installed,
 * the dynamic import in p2p-adapter.ts will fail gracefully and fall back
 * to the offline adapter.
 *
 * These declarations tell TypeScript what to expect when the module IS present.
 */
declare module "@meerkat/p2p" {
  import type { P2PAdapter } from "./types";

  /**
   * Creates and returns the P2P adapter singleton.
   * Called by resolveP2PAdapter() via dynamic import.
   */
  export function createP2PAdapter(): P2PAdapter;

  /**
   * Initialize the P2P manager with signaling options.
   * Must be called once at app startup before any P2P activity.
   */
  export function initP2P(options: {
    createSignalingChannel: (name: string) => any;
    iceServers?: RTCIceServer[];
  }): any;

  /**
   * Get the global P2P manager instance.
   * Throws if initP2P() has not been called.
   */
  export function getP2PManager(): any;

  /**
   * Reset the P2P manager (for testing).
   */
  export function resetP2PManager(): void;
}
