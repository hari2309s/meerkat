/**
 * Derive 1–2 uppercase initials from a display name.
 *
 * Splits on whitespace and takes the first character of each word, then
 * upper-cases and limits to the first two letters.
 *
 * @example
 *   getInitials("Meera Kat")   // "MK"
 *   getInitials("meera")       // "M"
 *   getInitials("")            // "?"
 *   getInitials("  ")          // "?"
 */
export function getInitials(name: string, maxLength = 2): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";

  return trimmed
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Resolve a display name from a sender object that may have full_name or email.
 * Falls back to "Unknown" when neither is present.
 *
 * Matches the pattern used throughout chat-area.tsx and voice-note-message.tsx:
 *   `msg.sender?.full_name ?? msg.sender?.email ?? "Unknown"`
 *
 * @example
 *   getSenderName({ full_name: "Meera Kat", email: "m@k.com" }) // "Meera Kat"
 *   getSenderName({ full_name: null, email: "m@k.com" })         // "m@k.com"
 *   getSenderName(undefined)                                      // "Unknown"
 */
export function getSenderName(
  sender:
    | { full_name?: string | null; email?: string | null }
    | null
    | undefined,
): string {
  return sender?.full_name ?? sender?.email ?? "Unknown";
}

/**
 * Truncate a string to `maxLength` characters, appending `suffix` when cut.
 *
 * @example
 *   truncate("Hello world", 5)       // "Hello…"
 *   truncate("Hi", 10)               // "Hi"
 *   truncate("Hello world", 5, "…") // "Hello…"
 */
export function truncate(str: string, maxLength: number, suffix = "…"): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + suffix;
}
