/**
 * vault-credentials.ts
 *
 * Pure on-device identity helpers for the V2 key-based auth flow.
 * The mnemonic IS the identity — no server, no Supabase, no network call.
 *
 * Storage:
 *   localStorage "vault_mnemonic"  — the 12-word BIP39 phrase
 *   localStorage "vault_profile"   — JSON: { name: string, createdAt: string }
 *   cookie       "vault_session"   — "1" — readable by middleware for route protection
 *
 * Key derivation:
 *   The mnemonic is also used to derive a deterministic AES-GCM-256
 *   encryption key via HKDF-SHA-256. This key is used to encrypt den/note
 *   data (voice blobs, attachments) before they reach Supabase Storage.
 *   The server only ever stores ciphertext — it cannot decrypt anything.
 *
 *   mnemonic (UTF-8)
 *     → HKDF-SHA-256 (info = "meerkat-vault-v1", no salt)
 *     → 256-bit AES-GCM CryptoKey (non-extractable)
 */

const MNEMONIC_STORAGE_KEY = "vault_mnemonic";
const PROFILE_STORAGE_KEY = "vault_profile";
export const VAULT_SESSION_COOKIE = "vault_session";
export const VAULT_PROFILE_NAME_COOKIE = "vault_profile_name";

// ---------------------------------------------------------------------------
// Mnemonic helpers
// ---------------------------------------------------------------------------
export function saveMnemonic(mnemonic: string): void {
  localStorage.setItem(MNEMONIC_STORAGE_KEY, mnemonic);
}

export function loadMnemonic(): string | null {
  return localStorage.getItem(MNEMONIC_STORAGE_KEY);
}

export function clearMnemonic(): void {
  localStorage.removeItem(MNEMONIC_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------
export interface VaultProfile {
  name: string;
  createdAt: string; // ISO-8601
}

export function saveProfile(profile: VaultProfile): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function loadProfile(): VaultProfile | null {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultProfile;
  } catch {
    return null;
  }
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Session cookie — written client-side so middleware can see it.
// A simple presence cookie (value "1"); the real secret stays in localStorage.
// ---------------------------------------------------------------------------
export function setVaultSessionCookie(): void {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  document.cookie = `${VAULT_SESSION_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function clearVaultSessionCookie(): void {
  document.cookie = `${VAULT_SESSION_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
}

// ---------------------------------------------------------------------------
// Full sign-out — clears everything on this device
// ---------------------------------------------------------------------------
// The profile (display name) is intentionally NOT cleared on sign-out because
// it is not sensitive. Keeping it means the greeting works correctly on
// re-login without asking "What should we call you?" every session.
// The mnemonic (the actual secret) is always cleared.
export function clearVault(): void {
  clearMnemonic();
  clearVaultSessionCookie();
  // Clear the server-readable profile name cookie so the server no longer
  // shows the name while the session is inactive.
  document.cookie = `vault_profile_name=; path=/; max-age=0; SameSite=Strict`;
}

// ---------------------------------------------------------------------------
// HKDF key derivation — derive a symmetric AES-GCM-256 key from the mnemonic.
//
// Uses HKDF-SHA-256 with a fixed info string so the derived key is:
//   • Deterministic — same mnemonic always yields the same key.
//   • Domain-separated — changing the info string produces a completely
//     different key, so future key versions won't collide with v1 blobs.
//   • Non-extractable — the CryptoKey cannot be read back from the runtime,
//     only used for encrypt/decrypt operations.
//
// No salt is used here because the mnemonic itself already carries 128 bits
// of entropy (BIP39 spec). A random salt would require storage and would
// break cross-device key derivation from the same mnemonic.
// ---------------------------------------------------------------------------
const HKDF_INFO = new TextEncoder().encode("meerkat-vault-v1");

/**
 * Derive an AES-GCM-256 CryptoKey from the given mnemonic phrase using
 * HKDF-SHA-256.
 *
 * The key is non-extractable — it can only be used for encrypt/decrypt
 * operations in the current page context, never exported to raw bytes.
 *
 * Call this once per session and cache the result. Re-deriving on every
 * encrypt/decrypt is wasteful but safe.
 *
 * @param mnemonic  The 12-word BIP39 phrase (trimmed, lowercased).
 * @returns         AES-GCM-256 CryptoKey ready for encryptBlob / decryptBlob.
 *
 * @example
 * ```ts
 * const mnemonic = loadMnemonic();
 * if (!mnemonic) throw new Error("No vault session");
 * const vaultKey = await deriveVaultKey(mnemonic);
 * const encrypted = await encryptBlob(audioBytes, vaultKey);
 * ```
 */
export async function deriveVaultKey(mnemonic: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const mnemonicBytes = enc.encode(mnemonic.trim().toLowerCase());

  // Step 1: Import the mnemonic bytes as HKDF key material.
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    mnemonicBytes,
    "HKDF",
    false, // non-extractable key material
    ["deriveKey"],
  );

  // Step 2: Derive the AES-GCM key via HKDF-SHA-256.
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      // No random salt — the mnemonic's own entropy is sufficient, and a
      // random salt would break key recovery from the same phrase on a new
      // device. An empty salt is explicitly allowed by RFC 5869 §2.2.
      salt: new Uint8Array(0),
      info: HKDF_INFO,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable — cannot be exfiltrated from the runtime
    ["encrypt", "decrypt"],
  );
}

/**
 * Convenience helper: load the mnemonic from localStorage and derive the
 * vault key in one call.
 *
 * Returns null if no vault session is active (mnemonic not in localStorage).
 * Callers should handle null gracefully and fall back to unencrypted upload
 * or surface an error.
 *
 * @example
 * ```ts
 * const vaultKey = await loadVaultKey();
 * if (vaultKey) {
 *   const encrypted = await encryptBlob(bytes, vaultKey);
 *   // upload encrypted blob …
 * } else {
 *   // no vault session — upload plaintext or abort
 * }
 * ```
 */
export async function loadVaultKey(): Promise<CryptoKey | null> {
  const mnemonic = loadMnemonic();
  if (!mnemonic) return null;
  return deriveVaultKey(mnemonic);
}
