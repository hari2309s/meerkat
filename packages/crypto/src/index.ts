// ─── @meerkat/crypto ─────────────────────────────────────────────────────────
//
// All encryption and decryption for Meerkat.
// Nothing in plaintext leaves the device without passing through here.
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │  Usage summary                                                      │
// ├──────────────────────────┬──────────────────────────────────────────┤
// │  private.ydoc at rest    │  deriveDeviceKey → encryptBlob           │
// │  shared.ydoc namespace   │  generateNamespaceKey → encryptBlob      │
// │  voice blobs (Storage)   │  generateNamespaceKey → encryptBlob      │
// │  flower pot bundles      │  generateKeyPair + encryptBundle         │
// │  visitor redeeming pot   │  decryptBundle                           │
// └──────────────────────────┴──────────────────────────────────────────┘

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  EncryptedBlob,
  EncryptedBundle,
  KeyPair,
  SerializedKeyPair,
  DeviceKeyMaterial,
} from "./types.js";

// ─── Encoding utilities ───────────────────────────────────────────────────────

export {
  toBase64,
  fromBase64,
  bufferToBase64,
  base64ToBuffer,
  encodeText,
  decodeText,
  randomBytes,
  constantTimeEqual,
} from "./lib/encoding.js";

// ─── Device key derivation ────────────────────────────────────────────────────

export {
  deriveDeviceKey,
  randomSalt,
  generateAesKey,
  exportAesKey,
  importAesKey,
} from "./lib/device-key.js";

// ─── Blob encryption (AES-GCM-256) ───────────────────────────────────────────

export {
  encryptBlob,
  decryptBlob,
  encryptString,
  decryptString,
  encryptJson,
  decryptJson,
} from "./lib/blob.js";

// ─── Namespace key management ─────────────────────────────────────────────────

export {
  NAMESPACES,
  generateNamespaceKey,
  generateNamespaceKeySet,
  serializeNamespaceKeySet,
  deserializeNamespaceKeySet,
  importNamespaceKey,
} from "./lib/namespace-key.js";

export type {
  Namespace,
  NamespaceKeyRaw,
  NamespaceKeySet,
  SerializedNamespaceKeySet,
} from "./lib/namespace-key.js";

// ─── Bundle encryption (NaCl box — asymmetric) ───────────────────────────────

export {
  generateKeyPair,
  serializeKeyPair,
  deserializeKeyPair,
  encryptBundle,
  decryptBundle,
} from "./lib/bundle.js";
