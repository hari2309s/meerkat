/**
 * Vault Den Registry
 *
 * For v2 (vault) users, dens exist only on-device in IndexedDB / Yjs.
 * This module maintains a lightweight index of den IDs + names in
 * localStorage so the dashboard can list them without a Supabase query.
 *
 * Two categories:
 *   - Owned dens: created by this user on this device (isOwned: true)
 *   - Joined dens: accessed via invite DenKey (isOwned: false)
 *
 * Both live in the same localStorage key. Two cookies mirror the data
 * so server components (which can't read localStorage) can access it:
 *   - vault_owned_dens: JSON array of owned den IDs (for ownership checks)
 *   - vault_all_dens:   JSON array of { id, name } for all dens (for den name lookup)
 */

export interface VaultDenEntry {
  id: string;
  name: string;
  createdAt: string;
  /** True for dens this user created; false for dens joined via invite. */
  isOwned?: boolean;
}

const VAULT_DENS_KEY = "vault_dens";

// Cookie: owned den IDs only — used by server components to check ownership.
export const VAULT_OWNED_DENS_COOKIE = "vault_owned_dens";

// Cookie: all dens (owned + joined) as { id, name }[] — used by the den page
// server component to resolve den names without a Supabase lookup.
export const VAULT_ALL_DENS_COOKIE = "vault_all_dens";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function syncCookies(): void {
  if (typeof document === "undefined") return;
  const all = getVaultDens();

  // vault_owned_dens: just the IDs of owned dens
  const ownedIds = all.filter((d) => d.isOwned !== false).map((d) => d.id);
  document.cookie = `${VAULT_OWNED_DENS_COOKIE}=${encodeURIComponent(JSON.stringify(ownedIds))}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Strict`;

  // vault_all_dens: { id, name } for every den (owned + joined)
  const allSlim = all.map((d) => ({ id: d.id, name: d.name }));
  document.cookie = `${VAULT_ALL_DENS_COOKIE}=${encodeURIComponent(JSON.stringify(allSlim))}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Strict`;
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

/** Only dens this user created (not joined via invite). */
export function getOwnedVaultDens(): VaultDenEntry[] {
  return getVaultDens().filter((d) => d.isOwned !== false);
}

/** Add a den this user created. */
export function addVaultDen(den: Omit<VaultDenEntry, "isOwned">): void {
  const dens = getVaultDens();
  if (dens.find((d) => d.id === den.id)) return;
  dens.push({ ...den, isOwned: true });
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
  syncCookies();
}

/** Add a den the user joined via invite (not owned). */
export function addJoinedVaultDen(den: Omit<VaultDenEntry, "isOwned">): void {
  const dens = getVaultDens();
  if (dens.find((d) => d.id === den.id)) return;
  dens.push({ ...den, isOwned: false });
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
  syncCookies();
}

export function updateVaultDenName(id: string, name: string): void {
  const dens = getVaultDens().map((d) => (d.id === id ? { ...d, name } : d));
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
  syncCookies();
}

export function removeVaultDen(id: string): void {
  const dens = getVaultDens().filter((d) => d.id !== id);
  localStorage.setItem(VAULT_DENS_KEY, JSON.stringify(dens));
  syncCookies();
}

/**
 * Returns true if the current vault user owns the given den (created it on
 * this device). Visitors who joined via invite return false.
 */
export function isOwnedVaultDen(denId: string): boolean {
  return getVaultDens().some((d) => d.id === denId && d.isOwned !== false);
}
