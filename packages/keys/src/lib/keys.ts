// ─── keys.ts ─────────────────────────────────────────────────────────────────
//
// Core lifecycle functions for the DenKey / flower pot system.
//
// Flow overview:
//
//   HOST side:
//     1. generateKey(input)        → DenKey (lives in private.ydoc settings)
//     2. depositKey(options)       → token string (shareable with visitor)
//     3. revokeKey(options)        → void (deletes flower pot from server)
//
//   VISITOR side:
//     4. redeemKey(options)        → DenKey (stored locally, used for P2P)
//
//   BOTH sides:
//     5. validateKey(key)          → boolean (checks expiry + scope integrity)
//
// Server interaction:
//   All server calls go through caller-provided functions (depositOnServer,
//   fetchFromServer, deleteFromServer). This package has zero Supabase imports.
//   The server only ever sees: denId, encrypted bundle, expiry.
//   It never sees the DenKey plaintext, namespace key bytes, or scope.

import {
  encryptBundle,
  decryptBundle,
  generateNamespaceKeySet,
  serializeNamespaceKeySet,
  type SerializedNamespaceKeySet,
  type Namespace,
} from "@meerkat/crypto";

import { KEY_PRESETS, defaultLabel } from "./presets";
import type {
  DenKey,
  GenerateKeyInput,
  DepositKeyOptions,
  RedeemKeyOptions,
  RevokeKeyOptions,
  KeyScope,
} from "../types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function generateKeyId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `key-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Filter a full SerializedNamespaceKeySet down to only the namespaces in scope.
 * A visitor cannot access namespaces whose keys are not in their DenKey.
 */
function scopeNamespaceKeys(
  allKeys: SerializedNamespaceKeySet,
  namespaces: Namespace[],
): SerializedNamespaceKeySet {
  const scoped: SerializedNamespaceKeySet = {};
  for (const ns of namespaces) {
    if (allKeys[ns]) {
      scoped[ns] = allKeys[ns];
    }
  }
  return scoped;
}

// ─── generateKey ─────────────────────────────────────────────────────────────

/**
 * Generate a new DenKey from either a named preset or a custom scope.
 *
 * The returned DenKey should be persisted in private.ydoc settings (encrypted
 * with the device key) so the host can track and revoke active keys.
 *
 * @example
 * ```ts
 * // Named preset
 * const key = generateKey({
 *   keyType: 'come-over',
 *   denId: user.id,
 *   allNamespaceKeys: serializedDenNamespaceKeys,
 *   durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
 * })
 *
 * // Custom
 * const key = generateKey({
 *   keyType: 'custom',
 *   denId: user.id,
 *   label: 'For Alice',
 *   scope: { namespaces: ['dropbox'], read: false, write: true, offline: true },
 *   allNamespaceKeys: serializedDenNamespaceKeys,
 * })
 * ```
 */
export function generateKey(input: GenerateKeyInput): DenKey {
  const { denId, durationMs, allNamespaceKeys } = input;

  let scope: KeyScope;
  let label: string;

  if (input.keyType === "custom") {
    scope = input.scope;
    label = input.label;
  } else {
    const preset = KEY_PRESETS[input.keyType];
    scope = preset.scope;
    label = input.label ?? defaultLabel(input.keyType);
  }

  // Only include keys for the namespaces this key actually grants access to
  const namespaceKeys = scopeNamespaceKeys(allNamespaceKeys, scope.namespaces);

  const issuedAt = new Date().toISOString();
  const expiresAt =
    durationMs != null ? new Date(Date.now() + durationMs).toISOString() : null;

  return {
    keyId: generateKeyId(),
    denId,
    label,
    keyType: input.keyType,
    scope,
    expiresAt,
    namespaceKeys,
    issuedAt,
  };
}

// ─── depositKey ──────────────────────────────────────────────────────────────

/**
 * Seal a DenKey for a visitor and deposit the encrypted bundle on the server
 * as a flower pot. Returns the shareable token string.
 *
 * The server receives:
 *   - denId (for routing)
 *   - encryptedBundle (opaque ciphertext)
 *   - expiresAt (for TTL)
 *
 * The server does NOT receive:
 *   - The DenKey plaintext
 *   - Any namespace key bytes
 *   - The scope or permissions
 *
 * @example
 * ```ts
 * const token = await depositKey({
 *   key,
 *   visitorPublicKey: visitor.publicKey,
 *   depositOnServer: async ({ denId, encryptedBundle, expiresAt }) => {
 *     const { token } = await trpc.keys.createFlowerPot.mutate({
 *       denId, encryptedBundle, expiresAt,
 *     })
 *     return token
 *   },
 * })
 * // Share token with visitor
 * ```
 */
export async function depositKey(options: DepositKeyOptions): Promise<string> {
  const { key, visitorPublicKey, depositOnServer } = options;

  // Seal the full DenKey object with the visitor's X25519 public key.
  // Only the holder of the matching secret key can open this.
  const bundle = encryptBundle(key, visitorPublicKey);
  const encryptedBundle = JSON.stringify(bundle);

  const token = await depositOnServer({
    denId: key.denId,
    encryptedBundle,
    expiresAt: key.expiresAt,
  });

  return token;
}

// ─── revokeKey ───────────────────────────────────────────────────────────────

/**
 * Revoke a flower pot by deleting it from the server.
 *
 * After this call, the token is dead — any visitor attempting to redeem it
 * will get a not-found error. Already-redeemed keys are not invalidated here;
 * that is handled at the P2P validation layer in Phase 4.
 *
 * @example
 * ```ts
 * await revokeKey({
 *   token,
 *   deleteFromServer: async (token) => {
 *     await trpc.keys.deleteFlowerPot.mutate({ token })
 *   },
 * })
 * ```
 */
export async function revokeKey(options: RevokeKeyOptions): Promise<void> {
  const { token, deleteFromServer } = options;
  await deleteFromServer(token);
}

// ─── redeemKey ───────────────────────────────────────────────────────────────

/**
 * Fetch and decrypt a flower pot using the visitor's secret key.
 * Returns the DenKey encoded inside. No Supabase auth required — anyone
 * with the token and the correct secret key can redeem it.
 *
 * @throws {Error} if the flower pot is not found or has expired.
 * @throws {Error} if decryption fails (wrong secret key or tampered bundle).
 *
 * @example
 * ```ts
 * const key = await redeemKey({
 *   token,
 *   visitorSecretKey: myKeyPair.secretKey,
 *   fetchFromServer: async (token) => {
 *     const pot = await trpc.keys.getFlowerPot.query({ token })
 *     return pot  // { encryptedBundle: string } | null
 *   },
 * })
 * // Persist key to localStorage or IndexedDB
 * ```
 */
export async function redeemKey(options: RedeemKeyOptions): Promise<DenKey> {
  const { token, visitorSecretKey, fetchFromServer } = options;

  const pot = await fetchFromServer(token);

  if (!pot) {
    throw new Error(
      `[@meerkat/keys] Flower pot not found for token "${token}". ` +
        "The key may have been revoked or the token is invalid.",
    );
  }

  let bundle: ReturnType<typeof JSON.parse>;
  try {
    bundle = JSON.parse(pot.encryptedBundle);
  } catch {
    throw new Error(
      "[@meerkat/keys] Failed to parse encrypted bundle from server. " +
        "The flower pot may be corrupted.",
    );
  }

  // Decrypt using the visitor's secret key. This will throw if the bundle
  // was sealed for a different public key, or has been tampered with.
  const key = decryptBundle<DenKey>(bundle, visitorSecretKey);

  // Validate the key we just decrypted (expiry check, scope sanity)
  if (!validateKey(key)) {
    throw new Error(
      `[@meerkat/keys] Redeemed key is invalid or expired (keyId: ${key.keyId}).`,
    );
  }

  return key;
}

// ─── validateKey ─────────────────────────────────────────────────────────────

/**
 * Check whether a DenKey is still valid.
 *
 * Checks:
 *   1. expiresAt — key must not be in the past
 *   2. scope.namespaces — must be non-empty
 *   3. namespaceKeys — every scoped namespace must have a key present
 *   4. scope consistency — read/write must be coherent with key type
 *
 * @returns true if the key is valid and usable, false otherwise.
 */
export function validateKey(key: DenKey): boolean {
  // 1. Expiry check
  if (key.expiresAt !== null) {
    const expiry = new Date(key.expiresAt).getTime();
    if (Date.now() > expiry) {
      return false;
    }
  }

  // 2. Non-empty scope
  if (!key.scope.namespaces || key.scope.namespaces.length === 0) {
    return false;
  }

  // 3. Key material present for every scoped namespace
  for (const ns of key.scope.namespaces) {
    if (!key.namespaceKeys[ns]) {
      return false;
    }
  }

  // 4. Must have at least read or write
  if (!key.scope.read && !key.scope.write) {
    return false;
  }

  return true;
}

// ─── generateDenNamespaceKeys (convenience) ──────────────────────────────────

/**
 * Generate all four namespace keys for a new den.
 *
 * This is a convenience wrapper around @meerkat/crypto's generateNamespaceKeySet.
 * Call this once when creating a den and store the result in private.ydoc settings
 * (encrypted with the device key). Pass the result to generateKey() as
 * `allNamespaceKeys`.
 *
 * @example
 * ```ts
 * // On den creation:
 * const allKeys = await generateDenNamespaceKeys()
 * // Store allKeys in private.ydoc settings (encrypted)
 *
 * // When generating a key for a visitor:
 * const key = generateKey({ keyType: 'come-over', denId, allNamespaceKeys: allKeys })
 * ```
 */
export async function generateDenNamespaceKeys(): Promise<SerializedNamespaceKeySet> {
  const rawKeys = await generateNamespaceKeySet();
  return serializeNamespaceKeySet(rawKeys);
}
