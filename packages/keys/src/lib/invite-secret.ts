/**
 * Invite secret key persistence helpers.
 *
 * The hash fragment (#sk=...) carrying the DenKey secret is lost across
 * browser redirects (e.g. unauthenticated user → signup → back to invite).
 * These helpers save and recover it using sessionStorage so the visitor can
 * still redeem the key after completing auth.
 */

const INVITE_SECRET_STORAGE_KEY = "meerkat:invite-secret";

/**
 * Read the current URL hash and persist the `sk` param to sessionStorage
 * keyed by the invite token. Call this before redirecting to auth.
 */
export function persistInviteSecret(token: string): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash?.slice(1) || "";
  const params = new URLSearchParams(hash);
  const sk = params.get("sk");
  if (sk) {
    try {
      sessionStorage.setItem(`${INVITE_SECRET_STORAGE_KEY}:${token}`, sk);
    } catch {
      // Storage may be full or unavailable
    }
  }
}

/**
 * Recover the invite secret from sessionStorage after auth completes.
 * Removes the entry on read — one-time use.
 */
export function recoverInviteSecret(token: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sk = sessionStorage.getItem(`${INVITE_SECRET_STORAGE_KEY}:${token}`);
    if (sk) {
      sessionStorage.removeItem(`${INVITE_SECRET_STORAGE_KEY}:${token}`);
      return sk;
    }
  } catch {
    // ignore
  }
  return null;
}
