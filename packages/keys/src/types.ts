// ─── @meerkat/keys types ─────────────────────────────────────────────────────
//
// All types related to the capability key system. These map directly to the
// dev plan's table and data model.

import type { Namespace, SerializedNamespaceKeySet } from "@meerkat/crypto";

// ─── Key types ────────────────────────────────────────────────────────────────

/**
 * The four named presets from the dev plan, plus "custom" for fine-grained
 * control. Each preset is a shorthand for a specific scope configuration.
 *
 * | Preset     | Namespaces                                    | read | write | offline |
 * |------------|-----------------------------------------------|------|-------|---------|
 * | come-over  | sharedNotes + voiceThread + presence          | ✓    | ✓     | ✗       |
 * | letterbox  | dropbox                                       | ✗    | ✓     | ✓       |
 * | house-sit  | sharedNotes + voiceThread + dropbox + presence| ✓    | ✓     | ✓       |
 * | peek       | sharedNotes + presence                        | ✓    | ✗     | ✗       |
 * | custom     | caller-specified                              | any  | any   | any     |
 */
export type KeyType =
  | "come-over"
  | "letterbox"
  | "house-sit"
  | "peek"
  | "custom";

/**
 * The capability scope encoded inside a DenKey.
 *
 * - namespaces: which segments of shared.ydoc the visitor may access
 * - read:       visitor can read from granted namespaces
 * - write:      visitor can write to granted namespaces
 * - offline:    key works for async drops when host is offline (Letterbox mode)
 */
export interface KeyScope {
  namespaces: Namespace[];
  read: boolean;
  write: boolean;
  offline: boolean;
}

/**
 * A DenKey is the full capability token stored on the visitor's device after
 * redeeming a flower pot. It encodes everything needed to open a scoped
 * session against shared.ydoc.
 *
 * The namespaceKeys values are serialised (base64url) raw key bytes from
 * @meerkat/crypto. Only the namespaces in scope are included — the visitor
 * cannot decrypt namespaces they have no key for.
 */
export interface DenKey {
  /** Stable ID for this key — used to find and revoke it later. */
  keyId: string;
  /** The den this key grants access to. */
  denId: string;
  /** Human-friendly label shown to the visitor and host. */
  label: string;
  /** Which preset this key was generated from. */
  keyType: KeyType;
  /** The capability scope. */
  scope: KeyScope;
  /** ISO-8601 timestamp when this key expires. null = never. */
  expiresAt: string | null;
  /**
   * Serialised namespace key bytes. Only the namespaces in scope are included.
   * Keys are base64url-encoded 32-byte raw AES key material.
   */
  namespaceKeys: SerializedNamespaceKeySet;
  /** ISO-8601 timestamp when this key was issued. */
  issuedAt: string;
}

// ─── Flower pot ───────────────────────────────────────────────────────────────

/**
 * The shape the server returns when a visitor looks up a flower pot by token.
 * The server stores only ciphertext — it cannot read the DenKey inside.
 */
export interface FlowerPotRecord {
  /** The public lookup token (not the hashed one stored in the DB). */
  token: string;
  /** den_id for routing — server can see this, but not the key contents. */
  denId: string;
  /** Serialised EncryptedBundle (JSON) — only the visitor's secret key can open it. */
  encryptedBundle: string;
  /** ISO-8601 expiry, mirroring the DenKey's expiresAt. */
  expiresAt: string | null;
  /** How many times this pot has been redeemed. */
  usedCount: number;
}

// ─── Options / inputs ─────────────────────────────────────────────────────────

/**
 * Input to generateKey(). Either a KeyType preset (recommended) or a fully
 * custom scope.
 */
export type GenerateKeyInput =
  | {
      keyType: Exclude<KeyType, "custom">;
      denId: string;
      label?: string;
      /** Duration in milliseconds. undefined = key never expires. */
      durationMs?: number;
      /** All namespace keys for the den, from @meerkat/crypto generateNamespaceKeySet. */
      allNamespaceKeys: SerializedNamespaceKeySet;
    }
  | {
      keyType: "custom";
      denId: string;
      label: string;
      scope: KeyScope;
      durationMs?: number;
      allNamespaceKeys: SerializedNamespaceKeySet;
    };

/**
 * Options for depositKey(). The caller provides the server interaction
 * function — this package has no Supabase dependency.
 */
export interface DepositKeyOptions {
  /** The DenKey to seal and deposit. */
  key: DenKey;
  /** The visitor's 32-byte X25519 public key from @meerkat/crypto generateKeyPair(). */
  visitorPublicKey: Uint8Array;
  /**
   * Caller-provided function that deposits the flower pot on the server.
   * Returns the shareable token string.
   * The server never sees the decrypted bundle.
   */
  depositOnServer: (pot: {
    denId: string;
    encryptedBundle: string;
    expiresAt: string | null;
  }) => Promise<string>;
}

/**
 * Options for redeemKey(). The caller provides the server fetch function
 * and the visitor's secret key.
 */
export interface RedeemKeyOptions {
  /** The token the visitor received (from a URL, QR code, etc.). */
  token: string;
  /** The visitor's 32-byte X25519 secret key. */
  visitorSecretKey: Uint8Array;
  /**
   * Caller-provided function that fetches the flower pot from the server.
   * Returns the encrypted bundle string (or null if not found / expired).
   */
  fetchFromServer: (
    token: string,
  ) => Promise<{ encryptedBundle: string } | null>;
}

/**
 * Options for revokeKey().
 */
export interface RevokeKeyOptions {
  token: string;
  deleteFromServer: (token: string) => Promise<void>;
}

// ─── Stored key (visitor side) ───────────────────────────────────────────────

/**
 * A redeemed DenKey as stored in the visitor's local storage.
 * Includes the original token so the visitor can reference which pot they used.
 */
export interface StoredDenKey {
  key: DenKey;
  redeemedAt: string;
  /** The token used to redeem this key — kept for display/revocation. */
  token: string;
}
