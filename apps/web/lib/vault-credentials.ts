/**
 * vault-credentials.ts
 *
 * Derives a deterministic, stable Supabase email + password from a BIP39
 * mnemonic. The mnemonic never leaves the client — Supabase only ever sees
 * the derived credentials, which are meaningless without the original phrase.
 *
 * Derivation:
 *   mnemonic (UTF-8)
 *     → SHA-256  → 32-byte digest
 *     → bytes  0-15 (hex) → email:    <hex>@meerkat.vault
 *     → bytes 16-31 (hex) → password: <hex>
 *
 * Place this file at:  apps/web/lib/vault-credentials.ts
 */

const VAULT_EMAIL_DOMAIN = "meerkat.vault";
const MNEMONIC_STORAGE_KEY = "vault_mnemonic";

// ---------------------------------------------------------------------------
// Core derivation — Web Crypto only, no extra deps
// ---------------------------------------------------------------------------
async function sha256(text: string): Promise<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text);
  return crypto.subtle.digest("SHA-256", encoded);
}

function toHex(buffer: ArrayBuffer, start: number, end: number): string {
  return Array.from(new Uint8Array(buffer).slice(start, end))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface VaultCredentials {
  email: string;
  password: string;
}

export async function deriveCredentials(
  mnemonic: string,
): Promise<VaultCredentials> {
  const digest = await sha256(mnemonic.trim().toLowerCase());
  const email = `${toHex(digest, 0, 16)}@${VAULT_EMAIL_DOMAIN}`;
  const password = toHex(digest, 16, 32);
  return { email, password };
}

// ---------------------------------------------------------------------------
// localStorage helpers
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
