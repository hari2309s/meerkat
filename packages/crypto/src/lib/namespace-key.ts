// ─── namespace-key.ts ────────────────────────────────────────────────────────
//
// Namespace keys are per-segment AES-GCM-256 keys for shared.ydoc.
//
// The shared.ydoc has four namespaces, as defined in the dev plan:
//   • sharedNotes   — notes the host surfaces to visitors
//   • voiceThread   — shared voice notes
//   • dropbox       — visitor write-only drops (offline capable)
//   • presence      — ephemeral, who is currently here
//
// Each namespace can have its own key so a Letterbox key grants access to
// only the dropbox namespace, while a Come Over key grants sharedNotes +
// voiceThread + presence. This is how the capability scoping works at the
// crypto layer.
//
// The raw key bytes (32 bytes each) are serialised into the DenKey bundle
// that gets encrypted with the visitor's public key and deposited as a
// flower pot. Visitors can only decrypt the namespaces whose keys are
// included in their bundle.

import { generateAesKey, exportAesKey, importAesKey } from "./device-key.js";
import { toBase64, fromBase64 } from "./encoding.js";

// ─── Namespace names (matches shared.ydoc structure from the dev plan) ────────

export const NAMESPACES = [
  "sharedNotes",
  "voiceThread",
  "dropbox",
  "presence",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

// ─── Namespace key set ────────────────────────────────────────────────────────

/** Raw 32-byte key for a single namespace. */
export type NamespaceKeyRaw = Uint8Array;

/**
 * A full set of namespace keys in raw byte form.
 * Only the namespaces included in this map can be decrypted by the holder.
 * Missing namespaces mean no access.
 */
export type NamespaceKeySet = Partial<Record<Namespace, NamespaceKeyRaw>>;

/**
 * Serialised form of a NamespaceKeySet — Base64url-encoded values,
 * suitable for inclusion in a DenKey bundle (JSON).
 */
export type SerializedNamespaceKeySet = Partial<Record<Namespace, string>>;

// ─── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate a fresh random 32-byte key for a single namespace.
 * Returns raw bytes so the caller can store or include in a bundle.
 *
 * @example
 * ```ts
 * const dropboxKey = await generateNamespaceKey()
 * // → Uint8Array(32) [ ... ]
 * ```
 */
export async function generateNamespaceKey(): Promise<NamespaceKeyRaw> {
  const cryptoKey = await generateAesKey();
  return exportAesKey(cryptoKey);
}

/**
 * Generate a full set of namespace keys — one per namespace in `namespaces`.
 * Used when creating a new den: generate all four keys once and persist them
 * in the private.ydoc settings map (encrypted with the device key).
 *
 * @param namespaces  Which namespaces to generate keys for.
 *                    Defaults to all four.
 *
 * @example
 * ```ts
 * // Host: generate full keyset for the den
 * const allKeys = await generateNamespaceKeySet()
 *
 * // Build a Letterbox key bundle (dropbox only)
 * const letterboxBundle: NamespaceKeySet = {
 *   dropbox: allKeys.dropbox,
 * }
 * ```
 */
export async function generateNamespaceKeySet(
  namespaces: Namespace[] = [...NAMESPACES],
): Promise<NamespaceKeySet> {
  const entries = await Promise.all(
    namespaces.map(async (ns) => [ns, await generateNamespaceKey()] as const),
  );
  return Object.fromEntries(entries) as NamespaceKeySet;
}

// ─── Serialisation ────────────────────────────────────────────────────────────

/**
 * Serialise a NamespaceKeySet to Base64url strings for JSON embedding.
 * Used when building the DenKey bundle before encrypting with encryptBundle.
 */
export function serializeNamespaceKeySet(
  keySet: NamespaceKeySet,
): SerializedNamespaceKeySet {
  const result: SerializedNamespaceKeySet = {};
  for (const ns of NAMESPACES) {
    const raw = keySet[ns];
    if (raw !== undefined) {
      result[ns] = toBase64(raw);
    }
  }
  return result;
}

/**
 * Deserialise a SerializedNamespaceKeySet back to raw bytes.
 * Called after decrypting a DenKey bundle on the visitor side.
 */
export function deserializeNamespaceKeySet(
  serialized: SerializedNamespaceKeySet,
): NamespaceKeySet {
  const result: NamespaceKeySet = {};
  for (const ns of NAMESPACES) {
    const b64 = serialized[ns];
    if (b64 !== undefined) {
      result[ns] = fromBase64(b64);
    }
  }
  return result;
}

// ─── CryptoKey import for live use ────────────────────────────────────────────

/**
 * Import a raw namespace key into a CryptoKey for use with encryptBlob/decryptBlob.
 * Call this lazily — import each key only when you need to encrypt/decrypt
 * that namespace, not at startup.
 *
 * @param raw  32-byte namespace key from a NamespaceKeySet.
 */
export async function importNamespaceKey(
  raw: NamespaceKeyRaw,
): Promise<CryptoKey> {
  return importAesKey(raw, false);
}
