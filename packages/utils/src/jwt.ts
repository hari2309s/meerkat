/**
 * Decode the base64url-encoded payload of a JWT and return it as a plain
 * object. Returns null if the token is malformed.
 */
export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(
      Buffer.from(part, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract the `session_id` claim from a Supabase JWT access token.
 * Returns null when the token is missing or doesn't contain the claim.
 *
 * Prefer this over matching sessions by recency — it is exact even when
 * another device has refreshed the token more recently.
 */
export function sessionIdFromJWT(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return typeof payload.session_id === "string" ? payload.session_id : null;
}
