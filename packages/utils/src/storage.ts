// ── Mute persistence ────────────────────────────────────────────────────────

const MUTE_KEY = (denId: string) => `muted_den_${denId}`;

/**
 * Read the persisted mute state for a den from localStorage.
 * Returns false when running server-side or when no value has been saved.
 */
export function loadMuteState(denId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY(denId)) === "1";
}

/**
 * Persist the mute state for a den to localStorage.
 * No-ops when running server-side.
 */
export function saveMuteState(denId: string, muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY(denId), muted ? "1" : "0");
}
