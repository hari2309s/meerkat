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

// ── Generic typed localStorage helpers ────────────────────────────────────

/**
 * Read a JSON-serialised value from localStorage.
 * Returns `defaultValue` when the key is absent, the JSON is invalid,
 * or the code is running server-side.
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Write a JSON-serialised value to localStorage.
 * No-ops when running server-side.
 */
export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-browsing restriction — silently ignore.
  }
}

/**
 * Remove a key from localStorage.
 * No-ops when running server-side.
 */
export function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
