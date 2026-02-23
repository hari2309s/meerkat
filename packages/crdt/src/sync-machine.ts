/**
 * @meerkat/crdt — sync state machine
 *
 * Manages the lifecycle of a den's network sync state.
 *
 * State machine:
 *
 *   ┌─────────┐   network up    ┌────────────┐   handshake ok   ┌────────┐
 *   │ offline │ ──────────────► │ connecting │ ───────────────► │ synced │
 *   └─────────┘                 └────────────┘                  └────────┘
 *        ▲                           │                               │
 *        │              timeout/fail │                    visitor ◄──┘
 *        └───────────────────────────┘                 connects
 *        network lost                                      │
 *                                                          ▼
 *                                                      ┌─────────┐
 *                                                      │ hosting │
 *                                                      └─────────┘
 *                                                    last visitor ─► synced
 *                                                    disconnects
 *
 * The machine is intentionally simple. It delegates the actual WebRTC work
 * to the P2PAdapter; its job is to translate adapter events into a clean
 * SyncStatus that the React layer can render without caring about transport.
 */

import type { SyncStatus, P2PAdapter } from "./types.js";

export type SyncStatusHandler = (status: SyncStatus) => void;

export class DenSyncMachine {
  private _status: SyncStatus;
  private readonly _handlers = new Set<SyncStatusHandler>();
  private _stopHosting: (() => void) | null = null;
  private _unsubscribeAdapter: (() => void) | null = null;

  constructor(
    private readonly denId: string,
    private readonly adapter: P2PAdapter,
    initialStatus: SyncStatus = "offline",
  ) {
    this._status = initialStatus;
  }

  get status(): SyncStatus {
    return this._status;
  }

  /**
   * Starts the sync machine for this den.
   * Wires up the P2P adapter and begins hosting if applicable.
   * Returns a cleanup function — call when the den unmounts.
   */
  start(): () => void {
    // Subscribe to P2P status changes
    this._unsubscribeAdapter = this.adapter.onStatusChange(
      this.denId,
      (status) => {
        this._transition(status);
      },
    );

    // Seed initial status from the adapter (sync, no await needed here)
    const adapterStatus = this.adapter.getStatus(this.denId);
    if (adapterStatus !== this._status) {
      this._transition(adapterStatus);
    }

    // Start hosting — the adapter listens for incoming visitor connections
    this._stopHosting = this.adapter.hostDen(this.denId);

    return () => this.stop();
  }

  /**
   * Stops the sync machine and cleans up all subscriptions.
   */
  stop(): void {
    this._stopHosting?.();
    this._stopHosting = null;

    this._unsubscribeAdapter?.();
    this._unsubscribeAdapter = null;

    // Transition to offline so any mounted components know sync stopped
    this._transition("offline");
  }

  /**
   * Subscribe to status changes.
   * Returns an unsubscribe function.
   */
  subscribe(handler: SyncStatusHandler): () => void {
    this._handlers.add(handler);
    // Immediately emit the current status so the subscriber is in sync
    handler(this._status);
    return () => {
      this._handlers.delete(handler);
    };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _transition(next: SyncStatus): void {
    if (next === this._status) return;

    const prev = this._status;
    this._status = next;

    // Validate transitions (log only — never throw, the app must keep running)
    if (!isValidTransition(prev, next)) {
      console.warn(
        `[@meerkat/crdt] Unexpected sync transition: ${prev} → ${next} for den ${this.denId}`,
      );
    }

    for (const handler of this._handlers) {
      try {
        handler(next);
      } catch (err) {
        console.error("[@meerkat/crdt] Sync status handler threw:", err);
      }
    }
  }
}

// ─── Valid transition table ───────────────────────────────────────────────────

function isValidTransition(from: SyncStatus, to: SyncStatus): boolean {
  const valid: Record<SyncStatus, SyncStatus[]> = {
    offline: ["connecting"],
    connecting: ["synced", "offline"],
    synced: ["hosting", "offline"],
    hosting: ["synced", "offline"],
  };
  return valid[from].includes(to);
}

// ─── Per-den machine registry ─────────────────────────────────────────────────

/**
 * One machine per den, shared across all components that mount for the same den.
 * This ensures there is only ever one hostDen() call per den per session.
 */
const machines = new Map<string, DenSyncMachine>();

export function getOrCreateMachine(
  denId: string,
  adapter: P2PAdapter,
): DenSyncMachine {
  const existing = machines.get(denId);
  if (existing) return existing;

  const machine = new DenSyncMachine(denId, adapter);
  machines.set(denId, machine);
  return machine;
}

export function destroyMachine(denId: string): void {
  const machine = machines.get(denId);
  if (!machine) return;
  machine.stop();
  machines.delete(denId);
}

/** For testing — resets all machine state. */
export function resetAllMachines(): void {
  for (const [denId, machine] of machines) {
    machine.stop();
    machines.delete(denId);
  }
}
