/**
 * Format a duration in whole seconds as MM:SS.
 *
 * @example
 *   formatDuration(0)    // "00:00"
 *   formatDuration(75)   // "01:15"
 *   formatDuration(3600) // "60:00"
 */
export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Alias kept for backwards compatibility with voice-note-recorder usage
 * where the local function was named `formatTime`.
 */
export const formatTime = formatDuration;

/**
 * Return a human-readable relative-time label for a past timestamp.
 *
 * Thresholds:
 *   < 1 min  → "Just now"
 *   < 1 h    → "Xm ago"
 *   < 24 h   → "Xh ago"
 *   ≥ 24 h   → "Xd ago"
 *
 * @param date - ISO-8601 string, Unix timestamp (ms), or Date object.
 *
 * @example
 *   relativeTime(new Date(Date.now() - 30_000))     // "Just now"
 *   relativeTime(new Date(Date.now() - 5 * 60_000)) // "5m ago"
 *   relativeTime(new Date(Date.now() - 3_600_000))  // "1h ago"
 */
export function relativeTime(date: string | number | Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
}

/**
 * Format a message timestamp as a short time string (e.g. "3:04 PM").
 * Matches the locale-aware format used in ChatArea.
 *
 * @param date - ISO-8601 string, Unix timestamp (ms), or Date object.
 */
export function formatMessageTime(date: string | number | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a full date as a long human-readable string (e.g. "June 3, 2024").
 * Matches the locale-aware format used in DenHeader.
 *
 * @param date - ISO-8601 string, Unix timestamp (ms), or Date object.
 */
export function formatFullDate(date: string | number | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
