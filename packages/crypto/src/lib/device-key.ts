// ─── device-key.ts ───────────────────────────────────────────────────────────
//
// Device key derivation for private.ydoc at-rest encryption.
//
// Design decisions:
//
//   PBKDF2-SHA-256 with 310,000 iterations (OWASP 2023 recommendation).
//   The passphrase fed to this function should be derived from the user's
//   Supabase auth token + a stable device identifier — NOT a raw human
//   password. That gives us the brute-force resistance of PBKDF2 while
//   keeping UX frictionless (no password prompt).
//
//   The derived key is non-extractable — once imported into the Web Crypto
//   API it cannot be read back from the JS runtime, only used for
//   encrypt/decrypt operations. This limits the blast radius if an attacker
//   achieves code execution: they can call encrypt/decrypt but cannot exfiltrate
//   the raw key bytes.
//
//   The salt is not secret. It must be stored persistently alongside any data
//   encrypted with the derived key. Without the salt, the key cannot be
//   re-derived on subsequent launches.

import { randomBytes } from "./encoding.js";
import type { DeviceKeyMaterial } from "../types.js";

const PBKDF2_ITERATIONS = 310_000; // OWASP 2023 for PBKDF2-SHA-256
const PBKDF2_HASH = "SHA-256";
const AES_KEY_BITS = 256;
const SALT_BYTES = 16;

/**
 * Derive a deterministic AES-GCM-256 CryptoKey from a passphrase and salt
 * using PBKDF2-SHA-256.
 *
 * The returned key is **non-extractable** — it can only be used for
 * encrypt/decrypt, never read back from the runtime.
 *
 * @param passphrase  Any UTF-8 string. Must be stable across sessions for the
 *                    same device. Recommended: HMAC(supabase_jwt, device_id).
 * @param salt        16+ random bytes. Generate once with randomSalt() and
 *                    persist. Changing the salt yields a completely different key.
 *
 * @example
 * ```ts
 * // First launch — generate and persist the salt.
 * const salt = randomSalt()
 * localStorage.setItem('den:salt', toBase64(salt))
 *
 * // Every launch — re-derive from the same passphrase + salt.
 * const storedSalt = fromBase64(localStorage.getItem('den:salt')!)
 * const { key } = await deriveDeviceKey(buildPassphrase(user, deviceId), storedSalt)
 * ```
 */
export async function deriveDeviceKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<DeviceKeyMaterial> {
  if (salt.length < 16) {
    throw new Error(
      `@meerkat/crypto: deriveDeviceKey — salt must be ≥16 bytes, got ${salt.length}`,
    );
  }

  const enc = new TextEncoder();

  // Step 1: import the raw passphrase bytes as a PBKDF2 base key.
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false, // non-extractable
    ["deriveKey"],
  );

  // Step 2: derive the AES-GCM key via PBKDF2.
  const key = await globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_BITS },
    false, // non-extractable — cannot be exported from the runtime
    ["encrypt", "decrypt"],
  );

  return { key, salt };
}

/**
 * Generate a fresh random salt for use with deriveDeviceKey().
 * Call this exactly once per den, then persist the result.
 */
export function randomSalt(): Uint8Array {
  return randomBytes(SALT_BYTES);
}

/**
 * Generate a random, extractable AES-GCM-256 CryptoKey.
 *
 * Used for:
 *   • Per-namespace keys for shared.ydoc segments
 *   • Per-blob keys for voice note encryption
 *
 * Extractable so the key bytes can be serialised into a DenKey bundle
 * or stored in IndexedDB.
 */
export async function generateAesKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_BITS },
    true, // extractable — we need to serialise these for key bundles
    ["encrypt", "decrypt"],
  );
}

/**
 * Export an extractable AES-GCM CryptoKey to raw bytes.
 * The returned Uint8Array is 32 bytes (256 bits).
 */
export async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await globalThis.crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

/**
 * Import raw bytes (32 bytes = 256 bits) as an AES-GCM CryptoKey.
 *
 * @param raw         32-byte key material.
 * @param extractable Whether the imported key can be exported again.
 *                    Set true when you need to re-serialise the key.
 *                    Set false (default) for keys that will only be used locally.
 */
export async function importAesKey(
  raw: Uint8Array,
  extractable = false,
): Promise<CryptoKey> {
  if (raw.length !== 32) {
    throw new Error(
      `@meerkat/crypto: importAesKey — expected 32 bytes, got ${raw.length}`,
    );
  }
  return globalThis.crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM", length: AES_KEY_BITS },
    extractable,
    ["encrypt", "decrypt"],
  );
}
