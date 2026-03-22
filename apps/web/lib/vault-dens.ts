/**
 * Vault Den Registry
 *
 * For v2 (vault) users, dens exist only on-device in IndexedDB / Yjs.
 * This module maintains a lightweight index of den IDs + names in
 * localStorage so the dashboard can list them without a Supabase query.
 */

export interface VaultDenEntry {
  id: string;
  name: string;
  createdAt: string;
}

const VAULT_DENS_KEY = "vault_dens";

// Cookie that mirrors the set of owned den IDs so server components can read
// it (localStorage is client-only). Updated every time addVaultDen /
// removeVaultDen is called. Value: URI-encoded JSON array of UUID strings.
export const VAULT_OWNED_DENS_COOKIE = "vault_owned_dens";

function syncOwnedDensCookie(): void {
  if (typeof document === "undefined") return;
  const ids = getVaultDens().map((d) => d.id);
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  document.cookie = `${VAULT_OWNED_DENS_COOKIE}=${encodeURIComponent(JSON.stringify(ids))}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function getVaultDens(): VaultDenEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      localStorage.getItem(VAULT_DENS_KEY) ?? "[]",
    ) as VaultDenEntry[];
  } catch {
    return [];
  }
}

export function addVaultDen(den: VaultDenEntry): void {
  const dens = getVaultDens();
  if (dens.find((d) => d.id === den.id)) return; // already registered
  dens.push(den);
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
  syncOwnedDensCookie();
}

export function updateVaultDenName(id: string, name: string): void {
  const dens = getVaultDens().map((d) => (d.id === id ? { ...d, name } : d));
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
}

export function removeVaultDen(id: string): void {
  const dens = getVaultDens().filter((d) => d.id !== id);
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
  syncOwnedDensCookie();
}

/**
 * Returns true if the current vault user owns the given den (i.e. created it
 * on this device). Visitors who joined via invite will return false because
 * their vault_dens registry only contains dens they own.
 */
export function isOwnedVaultDen(denId: string): boolean {
  return getVaultDens().some((d) => d.id === denId);
}
