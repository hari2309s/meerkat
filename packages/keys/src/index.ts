/**
 * @meerkat/keys
 *
 * Capability token system for Meerkat. Owns the full DenKey and flower pot
 * lifecycle: generate → deposit → share token → visitor redeems → validate.
 *
 * The server never sees the DenKey contents. It only stores:
 *   - denId (for routing)
 *   - encryptedBundle (opaque — only the visitor's secret key can open it)
 *   - expiresAt (for TTL enforcement)
 *
 * Architecture
 * ────────────
 *
 *   HOST side:
 *     generateKey(input)          → DenKey (store in private.ydoc settings)
 *     depositKey(options)         → token string (share this with the visitor)
 *     revokeKey(options)          → void (delete flower pot from server)
 *
 *   VISITOR side:
 *     redeemKey(options)          → DenKey (store locally for P2P sessions)
 *
 *   BOTH sides:
 *     validateKey(key)            → boolean (expiry + scope integrity check)
 *     generateDenNamespaceKeys()  → SerializedNamespaceKeySet (one-time setup)
 *
 *   React hooks:
 *     useGenerateKey()   — async state wrapper around generateKey + depositKey
 *     useRevokeKey()     — async state wrapper around revokeKey
 *     useRedeemKey()     — async state wrapper around redeemKey + localStorage
 *     useStoredKeys()    — read/manage visitor's stored DenKeys
 *     useValidateKey()   — reactive validation with expiry polling
 *
 * All server interaction is caller-provided — this package has no Supabase dependency.
 */

// ─── Core functions ───────────────────────────────────────────────────────────
export {
  generateKey,
  depositKey,
  revokeKey,
  redeemKey,
  validateKey,
  generateDenNamespaceKeys,
} from "./lib/keys";

// ─── React hooks ─────────────────────────────────────────────────────────────
export {
  useGenerateKey,
  useRevokeKey,
  useRedeemKey,
  useStoredKeys,
  useValidateKey,
} from "./hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  Namespace,
  SerializedNamespaceKeySet,
  KeyType,
  KeyScope,
  DenKey,
  FlowerPotRecord,
  GenerateKeyInput,
  DepositKeyOptions,
  RedeemKeyOptions,
  RevokeKeyOptions,
  StoredDenKey,
} from "./types";
