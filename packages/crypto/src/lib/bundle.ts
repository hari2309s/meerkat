// ─── bundle.ts ───────────────────────────────────────────────────────────────
//
// Asymmetric authenticated encryption for flower pot bundles.
//
// What is a bundle?
//   When the den host generates a DenKey for a visitor, they serialise it as
//   JSON (containing the scoped namespace key bytes, expiry, offline flag, etc.)
//   and seal it with the visitor's X25519 public key using NaCl box.
//   The sealed ciphertext is deposited as a flower pot on the server.
//   The server stores opaque bytes it cannot decrypt. The visitor redeems it
//   using their own secret key.
//
// Why NaCl box and not Web Crypto?
//   Web Crypto supports RSA-OAEP and ECDH, but:
//     • RSA-OAEP produces large keys (~2-8 KB public key).
//     • Web Crypto ECDH requires a KDF step to produce an AES key.
//   X25519 + XSalsa20-Poly1305 (NaCl box) gives us compact 32-byte keys,
//   a simple one-call API, and battle-tested security from the tweetnacl lib.
//   The tradeoff is a small external dependency (tweetnacl ~7 KB minified).
//
// Protocol:
//   1. Sender generates a fresh ephemeral keypair.
//   2. Sender computes shared secret from ephemeral secret + recipient public.
//   3. Sender encrypts plaintext with XSalsa20-Poly1305 using shared secret.
//   4. Sender transmits: ephemeral public key + nonce + ciphertext.
//   5. Recipient computes shared secret from recipient secret + ephemeral public.
//   6. Recipient decrypts.
//   The ephemeral keypair is discarded after step 3 — forward secrecy per message.

import nacl from "tweetnacl";
import {
  toBase64,
  fromBase64,
  encodeText,
  decodeText,
  randomBytes,
} from "./encoding.js";
import type { EncryptedBundle, KeyPair, SerializedKeyPair } from "../types.js";

const NONCE_BYTES = 24; // XSalsa20 nonce size

// ─── Key pair generation ──────────────────────────────────────────────────────

/**
 * Generate a fresh X25519 keypair for bundle encryption.
 *
 * The host calls this once when first setting up a den. The public key is
 * stored in the `dens` table (visible to the server — not secret). The
 * secret key stays on the device, stored encrypted in private.ydoc settings.
 *
 * @example
 * ```ts
 * const kp = generateKeyPair()
 * // Store public key on server (dens.public_key)
 * // Store secret key encrypted locally
 * ```
 */
export function generateKeyPair(): KeyPair {
  const kp = nacl.box.keyPair();
  return { publicKey: kp.publicKey, secretKey: kp.secretKey };
}

/**
 * Serialise a KeyPair to Base64url strings for localStorage / IndexedDB storage.
 */
export function serializeKeyPair(kp: KeyPair): SerializedKeyPair {
  return {
    publicKey: toBase64(kp.publicKey),
    secretKey: toBase64(kp.secretKey),
  };
}

/**
 * Deserialise a stored KeyPair back to Uint8Arrays.
 */
export function deserializeKeyPair(s: SerializedKeyPair): KeyPair {
  return {
    publicKey: fromBase64(s.publicKey),
    secretKey: fromBase64(s.secretKey),
  };
}

// ─── Encrypt bundle ───────────────────────────────────────────────────────────

/**
 * Seal a JSON-serialisable object with a recipient's X25519 public key.
 *
 * An ephemeral keypair is generated for each call, providing per-message
 * forward secrecy. The ephemeral public key is included in the bundle so the
 * recipient can derive the same shared secret without a pre-shared key.
 *
 * The server stores only the EncryptedBundle — it cannot decrypt it.
 *
 * @param data        Any JSON-serialisable value (e.g. a DenKey object).
 * @param publicKey   Recipient's 32-byte X25519 public key.
 * @returns           EncryptedBundle — JSON-safe, self-describing.
 *
 * @example
 * ```ts
 * // Host encrypts the DenKey for the visitor
 * const bundle = encryptBundle(denKey, visitorPublicKey)
 * await server.depositFlowerPot({ token, bundle: JSON.stringify(bundle) })
 * ```
 */
export function encryptBundle(
  data: unknown,
  publicKey: Uint8Array,
): EncryptedBundle {
  if (publicKey.length !== 32) {
    throw new Error(
      `@meerkat/crypto: encryptBundle — publicKey must be 32 bytes, got ${publicKey.length}`,
    );
  }

  // Generate a fresh ephemeral keypair for this message.
  const ephemeral = nacl.box.keyPair();
  const nonce = randomBytes(NONCE_BYTES);
  const message = encodeText(JSON.stringify(data));

  const ciphertext = nacl.box(message, nonce, publicKey, ephemeral.secretKey);

  if (ciphertext === null) {
    // nacl.box returns null only on invalid key sizes — guard defensively.
    throw new Error(
      "@meerkat/crypto: encryptBundle — nacl.box encryption failed",
    );
  }

  return {
    alg: "NACL-BOX",
    ephemeralPublicKey: toBase64(ephemeral.publicKey),
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext),
  };
}

// ─── Decrypt bundle ───────────────────────────────────────────────────────────

/**
 * Open a sealed bundle using the recipient's X25519 secret key.
 *
 * Called by the visitor after picking up a flower pot from the server.
 * Returns the original data object as typed by the caller.
 *
 * @param bundle      The EncryptedBundle from the server.
 * @param secretKey   Recipient's 32-byte X25519 secret key (stored locally).
 * @returns           The original data object.
 *
 * @throws {Error}    If the algorithm tag is unrecognised.
 * @throws {Error}    If decryption fails (wrong key, or ciphertext tampered).
 *
 * @example
 * ```ts
 * // Visitor redeems the flower pot
 * const raw = await server.getFlowerPot(token)
 * const bundle: EncryptedBundle = JSON.parse(raw)
 * const denKey = decryptBundle<DenKey>(bundle, mySecretKey)
 * ```
 */
export function decryptBundle<T = unknown>(
  bundle: EncryptedBundle,
  secretKey: Uint8Array,
): T {
  if (bundle.alg !== "NACL-BOX") {
    throw new Error(
      `@meerkat/crypto: decryptBundle — unsupported algorithm "${bundle.alg}". ` +
        `Only "NACL-BOX" is supported.`,
    );
  }

  if (secretKey.length !== 32) {
    throw new Error(
      `@meerkat/crypto: decryptBundle — secretKey must be 32 bytes, got ${secretKey.length}`,
    );
  }

  const ephemeralPublicKey = fromBase64(bundle.ephemeralPublicKey);
  const nonce = fromBase64(bundle.nonce);
  const ciphertext = fromBase64(bundle.ciphertext);

  const plaintext = nacl.box.open(
    ciphertext,
    nonce,
    ephemeralPublicKey,
    secretKey,
  );

  if (plaintext === null) {
    throw new Error(
      "@meerkat/crypto: decryptBundle — decryption failed. " +
        "The key is wrong or the bundle has been tampered with.",
    );
  }

  return JSON.parse(decodeText(plaintext)) as T;
}
