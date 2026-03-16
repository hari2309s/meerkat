// ─── encrypted-settings.ts ───────────────────────────────────────────────────
//
// Encrypted wrappers around getSetting / setSetting.
//
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────────
// y-indexeddb persists Yjs documents to IndexedDB as raw binary updates.
// The IndexedDB bytes are not encrypted, so they are readable by any
// JavaScript running on the same origin (XSS, malicious extensions).
//
// Full document encryption (encrypting all Yjs updates before IDB write) is
// planned for Phase 5. In the meantime, this module provides the most
// important protection: encrypting the highest-value values stored in the
// settings map — the NaCl keypair (box.secretKey) and the namespace AES keys.
//
// DESIGN
// ─────────────────────────────────────────────────────────────────────────────
// Values are wrapped as { __secure: true, blob: EncryptedBlob } before being
// passed to the underlying setSetting(). On read, getSecureSetting() detects
// the wrapper and decrypts with decryptJson(). If the value is absent or was
// written without encryption (e.g. a migration scenario), it returns null so
// callers can detect and re-encrypt.
//
// The device key is the AES-GCM-256 CryptoKey from deriveDeviceKey(). It is
// non-extractable — an attacker with code execution can call encrypt/decrypt
// but cannot exfiltrate the raw key bytes, limiting the blast radius.
//
// SECURITY NOTE
// ─────────────────────────────────────────────────────────────────────────────
// This module only protects settings. Note content, voice memo metadata, and
// mood journal entries stored in the same Yjs doc remain unencrypted in IDB
// until Phase 5 ships the full encrypted persistence provider.
// See: packages/local-store/src/den.ts — TODO: Phase 5 full IDB encryption.

import { encryptJson, decryptJson } from "@meerkat/crypto";
import type { EncryptedBlob } from "@meerkat/crypto";
import { getSetting, setSetting, deleteSetting } from "./settings.js";

// ─── Internal wrapper type ────────────────────────────────────────────────────

interface SecureSettingValue {
  __secure: true;
  blob: EncryptedBlob;
}

function isSecureValue(v: unknown): v is SecureSettingValue {
  return (
    typeof v === "object" &&
    v !== null &&
    "__secure" in v &&
    (v as SecureSettingValue).__secure === true &&
    "blob" in v
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt a JSON-serialisable value and store it in the den's settings map.
 *
 * Use this for all sensitive settings — NaCl keypairs, namespace key bytes,
 * device identifiers — anything that must not be readable if IndexedDB is
 * dumped.
 *
 * @param denId      The den to write to.
 * @param key        Settings key (e.g. "box.keypair", "namespace.keys").
 * @param value      Any JSON-serialisable value.
 * @param deviceKey  AES-GCM-256 CryptoKey from deriveDeviceKey().
 *
 * @example
 * ```ts
 * const { key: deviceKey } = await deriveDeviceKey(passphrase, salt)
 * await setSecureSetting(userId, 'box.keypair', { publicKey, secretKey }, deviceKey)
 * ```
 */
export async function setSecureSetting<T>(
  denId: string,
  key: string,
  value: T,
  deviceKey: CryptoKey,
): Promise<void> {
  const blob = await encryptJson(value, deviceKey);
  const wrapper: SecureSettingValue = { __secure: true, blob };
  await setSetting(denId, key, wrapper);
}

/**
 * Read and decrypt a secure setting written by setSecureSetting().
 *
 * Returns null if:
 *   - The key has never been set.
 *   - The value was written without encryption (plaintext migration case).
 *
 * Throws if the ciphertext has been tampered with (AES-GCM auth tag mismatch).
 *
 * @param denId      The den to read from.
 * @param key        Settings key.
 * @param deviceKey  The same AES-GCM-256 CryptoKey used during setSecureSetting().
 * @returns          The decrypted value, or null if not found / not encrypted.
 *
 * @example
 * ```ts
 * const kp = await getSecureSetting<SerializedKeyPair>(userId, 'box.keypair', deviceKey)
 * if (!kp) { // first launch — generate and store
 *   const freshKp = generateKeyPair()
 *   await setSecureSetting(userId, 'box.keypair', serializeKeyPair(freshKp), deviceKey)
 * }
 * ```
 */
export async function getSecureSetting<T>(
  denId: string,
  key: string,
  deviceKey: CryptoKey,
): Promise<T | null> {
  const raw = await getSetting<unknown>(denId, key);
  if (raw === undefined || raw === null) return null;

  if (!isSecureValue(raw)) {
    // Value exists but was not written with encryption — caller should
    // re-encrypt it with setSecureSetting() during a migration pass.
    return null;
  }

  return decryptJson<T>(raw.blob, deviceKey);
}

/**
 * Delete a secure setting. Thin wrapper around deleteSetting().
 */
export async function deleteSecureSetting(
  denId: string,
  key: string,
): Promise<void> {
  return deleteSetting(denId, key);
}
