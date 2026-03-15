/**
 * Activity store — tracks per-den unread state and pending drop counts.
 *
 * Persisted to localStorage so state survives page refreshes and is
 * available on the home page without reopening every den's Yjs doc.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. Inside a den page, `useDenActivityReporter` calls `reportActivity` and
 *    `reportDrops` as content changes.
 * 2. When the user clicks a den card on the home page, `markVisited` is called
 *    immediately — clearing the unread dot for that den.
 * 3. `hasUnreadByDenId(denId)` returns true when lastActivity > lastVisited.
 * 4. `totalPendingDrops` sums pendingDrops across all owned dens for the nav badge.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ActivityState {
  /** Epoch-ms when the user last navigated INTO each den */
  lastVisited: Record<string, number>;
  /** Latest content timestamp (notes / voice memos) observed per den */
  lastActivity: Record<string, number>;
  /** Pending letterbox drop count per den (owner-side only) */
  pendingDrops: Record<string, number>;

  markVisited: (denId: string) => void;
  reportActivity: (denId: string, latestTimestamp: number) => void;
  reportDrops: (denId: string, count: number) => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      lastVisited: {},
      lastActivity: {},
      pendingDrops: {},

      markVisited: (denId) =>
        set((s) => ({
          lastVisited: { ...s.lastVisited, [denId]: Date.now() },
        })),

      reportActivity: (denId, latestTimestamp) =>
        set((s) => {
          const current = s.lastActivity[denId] ?? 0;
          if (latestTimestamp <= current) return s; // no change
          return {
            lastActivity: { ...s.lastActivity, [denId]: latestTimestamp },
          };
        }),

      reportDrops: (denId, count) =>
        set((s) => {
          if (s.pendingDrops[denId] === count) return s; // no change
          return {
            pendingDrops: { ...s.pendingDrops, [denId]: count },
          };
        }),
    }),
    { name: "meerkat:activity" },
  ),
);

/** True when the den has content newer than the user's last visit. */
export function hasUnreadByDenId(state: ActivityState, denId: string): boolean {
  return (state.lastActivity[denId] ?? 0) > (state.lastVisited[denId] ?? 0);
}

/** Total pending letterbox drops across all dens. */
export function selectTotalPendingDrops(state: ActivityState): number {
  return Object.values(state.pendingDrops).reduce((a, b) => a + b, 0);
}
