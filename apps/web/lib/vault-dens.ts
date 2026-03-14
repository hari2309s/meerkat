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
}

export function updateVaultDenName(id: string, name: string): void {
  const dens = getVaultDens().map((d) => (d.id === id ? { ...d, name } : d));
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
}

export function removeVaultDen(id: string): void {
  const dens = getVaultDens().filter((d) => d.id !== id);
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
}
