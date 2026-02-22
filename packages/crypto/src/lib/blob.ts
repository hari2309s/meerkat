// ─── blob.ts ──────────────────────────────────────────────────────────────────
//
// AES-GCM-256 authenticated encryption for arbitrary binary data.
//
// Used for:
//   • private.ydoc bytes before writing to IndexedDB
//   • Voice audio blobs before upload to Supabase Storage
//   • Any binary payload that must not leave the device in plaintext
//
// Algorithm: AES-GCM-256
//   • Authenticated encryption — ciphertext tampering is detected automatically
//     via the 16-byte Poly1305-equivalent auth tag appended by Web Crypto.
//   • 12-byte random IV per operation — NEVER reuse an IV with the same key.
//   • The auth tag is included in the ciphertext ArrayBuffer returned by
//     crypto.subtle.encrypt (last 16 bytes), so we don't need to handle it
//     separately.
//
// Format: EncryptedBlob — JSON-serialisable, self-describing.
// The `alg` field lets future versions detect and reject/migrate old blobs.

import { toBase64, fromBase64, randomBytes } from "./encoding.js";
import type { EncryptedBlob } from "../types.js";

const IV_BYTES = 12; // 96 bits — the recommended IV size for AES-GCM

// ─── Core encrypt / decrypt ───────────────────────────────────────────────────

/**
 * Encrypt arbitrary binary data with an AES-GCM-256 CryptoKey.
 *
 * A fresh random IV is generated for every call. The IV is stored inside the
 * returned EncryptedBlob alongside the ciphertext — you do NOT need to store
 * it separately.
 *
 * @param data  Plaintext bytes.
 * @param key   AES-GCM CryptoKey — from deriveDeviceKey, importAesKey, etc.
 * @returns     EncryptedBlob — safe to stringify and persist anywhere.
 *
 * @example
 * ```ts
 * const { key } = await deriveDeviceKey(passphrase, salt)
 * const encrypted = await encryptBlob(Y.encodeStateAsUpdate(ydoc), key)
 * await idb.put('private.ydoc', JSON.stringify(encrypted))
 * ```
 */
export async function encryptBlob(
  data: Uint8Array,
  key: CryptoKey,
): Promise<EncryptedBlob> {
  const iv = randomBytes(IV_BYTES);

  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource,
  );

  return {
    alg: "AES-GCM-256",
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt an EncryptedBlob back to its original binary data.
 *
 * @param blob  The EncryptedBlob produced by encryptBlob.
 * @param key   The same AES-GCM CryptoKey used during encryption.
 * @returns     Original plaintext bytes.
 *
 * @throws {DOMException} "OperationError" if the key is wrong or the
 *         ciphertext has been tampered with (auth tag mismatch).
 * @throws {Error} if the blob has an unrecognised algorithm tag.
 *
 * @example
 * ```ts
 * const raw = await idb.get('private.ydoc')
 * const blob: EncryptedBlob = JSON.parse(raw)
 * const { key } = await deriveDeviceKey(passphrase, storedSalt)
 * const bytes = await decryptBlob(blob, key)
 * Y.applyUpdate(ydoc, bytes)
 * ```
 */
export async function decryptBlob(
  blob: EncryptedBlob,
  key: CryptoKey,
): Promise<Uint8Array> {
  if (blob.alg !== "AES-GCM-256") {
    throw new Error(
      `@meerkat/crypto: decryptBlob — unsupported algorithm "${blob.alg}". ` +
        `Only "AES-GCM-256" is supported.`,
    );
  }

  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.data);

  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );

  return new Uint8Array(plaintext);
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/**
 * Encrypt a UTF-8 string. Thin wrapper around encryptBlob.
 */
export async function encryptString(
  text: string,
  key: CryptoKey,
): Promise<EncryptedBlob> {
  return encryptBlob(new TextEncoder().encode(text), key);
}

/**
 * Decrypt a blob that was encrypted with encryptString.
 */
export async function decryptString(
  blob: EncryptedBlob,
  key: CryptoKey,
): Promise<string> {
  const bytes = await decryptBlob(blob, key);
  return new TextDecoder().decode(bytes);
}

/**
 * Encrypt any JSON-serialisable value. Thin wrapper around encryptString.
 *
 * Used for storing DenKey bundles, settings, and other structured data
 * that needs to be encrypted at rest.
 */
export async function encryptJson<T>(
  value: T,
  key: CryptoKey,
): Promise<EncryptedBlob> {
  return encryptString(JSON.stringify(value), key);
}

/**
 * Decrypt a blob that was encrypted with encryptJson.
 */
export async function decryptJson<T>(
  blob: EncryptedBlob,
  key: CryptoKey,
): Promise<T> {
  const text = await decryptString(blob, key);
  return JSON.parse(text) as T;
}
