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
 */

const MNEMONIC_STORAGE_KEY = "vault_mnemonic";
const PROFILE_STORAGE_KEY = "vault_profile";
export const VAULT_SESSION_COOKIE = "vault_session";

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
export function clearVault(): void {
  clearMnemonic();
  clearProfile();
  clearVaultSessionCookie();
  // Also clear the server-readable profile name cookie
  document.cookie = `vault_profile_name=; path=/; max-age=0; SameSite=Strict`;
}
