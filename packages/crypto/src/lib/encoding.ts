// ─── encoding.ts ─────────────────────────────────────────────────────────────
//
// Low-level helpers used throughout the package.
// No external dependencies — everything here is either standard JS or the
// globalThis.crypto CSPRNG that is available in all Meerkat targets
// (modern browsers and Node 18+).

// ─── Base64url ────────────────────────────────────────────────────────────────
//
// We use the URL-safe variant (no +, / or = padding) everywhere.
// This keeps keys and tokens safe in URLs, JSON, and localStorage without
// any extra encoding.

/**
 * Encode a Uint8Array to a Base64url string (no padding).
 */
export function toBase64(bytes: Uint8Array): string {
  // btoa works on binary strings — build one byte at a time.
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a Base64url string (with or without padding) to a Uint8Array.
 */
export function fromBase64(b64: string): Uint8Array {
  // Normalise URL-safe alphabet back to standard.
  const standard = b64.replace(/-/g, "+").replace(/_/g, "/");
  // Re-pad to a multiple of 4.
  const padded = standard.padEnd(
    standard.length + ((4 - (standard.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode an ArrayBuffer to Base64url.
 */
export function bufferToBase64(buf: ArrayBuffer): string {
  return toBase64(new Uint8Array(buf));
}

/**
 * Decode a Base64url string to an ArrayBuffer.
 */
export function base64ToBuffer(b64: string): ArrayBuffer {
  return fromBase64(b64).buffer as ArrayBuffer;
}

// ─── Text codec ───────────────────────────────────────────────────────────────

const _encoder = new TextEncoder();
const _decoder = new TextDecoder();

/** Encode a UTF-8 string to bytes. */
export function encodeText(text: string): Uint8Array {
  return _encoder.encode(text);
}

/** Decode bytes to a UTF-8 string. */
export function decodeText(bytes: Uint8Array): string {
  return _decoder.decode(bytes);
}

// ─── CSPRNG ───────────────────────────────────────────────────────────────────

/**
 * Generate `length` cryptographically secure random bytes.
 * Uses globalThis.crypto.getRandomValues which is available in:
 *   • All modern browsers (Chrome 37+, Firefox 34+, Safari 7+)
 *   • Node.js 15+ (globalThis.crypto) / Node 18+ (stable)
 *   • Deno, Bun, Cloudflare Workers
 */
export function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

// ─── Constant-time comparison ─────────────────────────────────────────────────

/**
 * Compare two Uint8Arrays in constant time to prevent timing attacks.
 * Use this when comparing MACs, tokens, or any secret-derived values.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] as number) ^ (b[i] as number);
  }
  return diff === 0;
}
