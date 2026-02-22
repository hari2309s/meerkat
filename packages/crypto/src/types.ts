// ─── Encrypted blob ──────────────────────────────────────────────────────────
//
// Everything encrypted by this package is stored as an EncryptedBlob.
// The format is self-describing: algorithm, iv, and ciphertext travel together
// so a future version can change algorithms without breaking older data.

export interface EncryptedBlob {
  /** Algorithm identifier — future-proofs the format. */
  alg: "AES-GCM-256";
  /** Base64-encoded 12-byte initialisation vector. */
  iv: string;
  /** Base64-encoded ciphertext. */
  data: string;
}

// ─── Encrypted bundle ────────────────────────────────────────────────────────
//
// A bundle is a JSON payload (e.g. a DenKey) that has been sealed with a
// recipient's X25519 public key using NaCl box (Curve25519 + XSalsa20 + Poly1305).
// The sender's ephemeral public key is included so the recipient can derive the
// shared secret without a pre-shared key.

export interface EncryptedBundle {
  /** Algorithm identifier. */
  alg: "NACL-BOX";
  /** Base64-encoded ephemeral X25519 public key (sender side). */
  ephemeralPublicKey: string;
  /** Base64-encoded 24-byte nonce. */
  nonce: string;
  /** Base64-encoded ciphertext + MAC. */
  ciphertext: string;
}

// ─── Key pair ────────────────────────────────────────────────────────────────

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

// ─── Serialised key pair ─────────────────────────────────────────────────────
//
// Stored in the den's local settings so the same identity persists across
// sessions. Both values are Base64-encoded.

export interface SerializedKeyPair {
  publicKey: string;
  secretKey: string;
}

// ─── Device key material ─────────────────────────────────────────────────────
//
// Returned by deriveDeviceKey so callers have the CryptoKey for encryption
// and the salt for persisting alongside the data (salt must survive to re-derive).

export interface DeviceKeyMaterial {
  /** AES-GCM key ready for use with encryptBlob / decryptBlob. */
  key: CryptoKey;
  /** 16-byte random salt used during derivation. Persist this. */
  salt: Uint8Array;
}
