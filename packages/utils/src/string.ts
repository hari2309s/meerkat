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
 * Resolve a display name from a sender object, prioritizing preferred_name.
 * If preferred_name is missing/empty, it extracts the first name from full_name.
 * Falls back to email or "Unknown" if no names are available.
 *
 * @example
 *   getDisplayName({ preferred_name: "Hari", full_name: "Hariharan S" }) // "Hari"
 *   getDisplayName({ preferred_name: null, full_name: "Hariharan S" })   // "Hariharan"
 */
export function getDisplayName(
  sender:
    | {
        preferred_name?: string | null;
        full_name?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
): string {
  if (!sender) return "Unknown";

  const preferred = sender.preferred_name?.trim();
  if (preferred) return preferred;

  const full = sender.full_name?.trim();
  if (full) {
    // Extract first name (first word)
    return full.split(/\s+/)[0] || full;
  }

  const email = sender.email?.trim();
  if (email) {
    return email.split("@")[0] || email;
  }

  return "Unknown";
}

/**
 * Resolve a display name from a sender object that may have full_name or email.
 * Delegates to getDisplayName for the prioritized display logic.
 */
export function getSenderName(
  sender:
    | {
        full_name?: string | null;
        preferred_name?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
): string {
  return getDisplayName(sender);
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
