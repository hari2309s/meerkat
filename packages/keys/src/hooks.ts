// ─── hooks.ts ────────────────────────────────────────────────────────────────
//
// React hooks for the DenKey system.
//
// useGenerateKey()   — host: generate + deposit a key, track async state
// useRevokeKey()     — host: revoke a flower pot
// useRedeemKey()     — visitor: redeem a token and store the resulting DenKey
// useStoredKeys()    — visitor: read back stored DenKeys from localStorage
// useValidateKey()   — both: check if a key is still valid

import { useState, useCallback, useEffect } from "react";
import {
  generateKey,
  depositKey,
  revokeKey,
  redeemKey,
  validateKey,
} from "./lib/keys";
import type {
  DenKey,
  GenerateKeyInput,
  DepositKeyOptions,
  RedeemKeyOptions,
  RevokeKeyOptions,
  StoredDenKey,
} from "./types";

// ─── Storage key helpers ───────────────────────────────────────────────────────
//
// Visitor key storage is split across two stores to minimise the exposure of
// raw AES namespace key bytes:
//
//   localStorage (persistent, survives restarts)
//     "meerkat:den-keys"  →  StoredDenKey[] but with namespaceKeys STRIPPED.
//     Stores only key metadata: keyId, denId, label, scope, expiry, issuedAt.
//     Safe at rest — no cryptographic material.
//
//   sessionStorage (tab-scoped, cleared when the tab/browser closes)
//     "meerkat:den-keys:material"  →  Record<keyId, SerializedNamespaceKeySet>
//     Stores only the namespace key bytes, keyed by keyId.
//     Lost on session end — re-redemption is required in a new session.
//
// This means XSS or a malicious extension reading localStorage sees no key
// bytes. The keys survive in sessionStorage for the lifetime of the tab.

const LS_KEY = "meerkat:den-keys";
const SS_KEY = "meerkat:den-keys:material";

type MaterialMap = Record<string, StoredDenKey["key"]["namespaceKeys"]>;

function loadMaterialMap(): MaterialMap {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? (JSON.parse(raw) as MaterialMap) : {};
  } catch {
    return {};
  }
}

function saveMaterialMap(map: MaterialMap): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(map));
  } catch {
    // sessionStorage quota exceeded — fail silently
  }
}

function loadStoredKeys(): StoredDenKey[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const metadata = JSON.parse(raw) as StoredDenKey[];
    // Re-attach namespace key bytes from sessionStorage (present only if the
    // key was redeemed in this session, or if we just wrote it).
    const material = loadMaterialMap();
    return metadata.map((s) => ({
      ...s,
      key: {
        ...s.key,
        namespaceKeys: material[s.key.keyId] ?? {},
      },
    }));
  } catch {
    return [];
  }
}

function saveStoredKeys(keys: StoredDenKey[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    // Write metadata (no key bytes) to localStorage.
    const metadata = keys.map((s) => ({
      ...s,
      key: {
        ...s.key,
        namespaceKeys: {} as StoredDenKey["key"]["namespaceKeys"],
      },
    }));
    localStorage.setItem(LS_KEY, JSON.stringify(metadata));

    // Write namespace key bytes to sessionStorage only.
    const material: MaterialMap = {};
    for (const s of keys) {
      if (Object.keys(s.key.namespaceKeys).length > 0) {
        material[s.key.keyId] = s.key.namespaceKeys;
      }
    }
    saveMaterialMap(material);
  } catch {
    // Storage quota exceeded or private browsing restriction — fail silently
    console.warn("[@meerkat/keys] Failed to persist keys to storage");
  }
}

// ─── useGenerateKey ───────────────────────────────────────────────────────────

interface UseGenerateKeyReturn {
  generate: (
    input: GenerateKeyInput,
    depositOptions: Omit<DepositKeyOptions, "key">,
  ) => Promise<{ key: DenKey; token: string }>;
  isGenerating: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Hook for the host to generate a DenKey and deposit its flower pot.
 *
 * @example
 * ```tsx
 * const { generate, isGenerating, error } = useGenerateKey()
 *
 * const handleCreate = async () => {
 *   const { token } = await generate(
 *     { keyType: 'come-over', denId, allNamespaceKeys },
 *     {
 *       visitorPublicKey: visitor.publicKey,
 *       depositOnServer: async (pot) => trpc.keys.createFlowerPot.mutate(pot),
 *     },
 *   )
 *   setShareableToken(token)
 * }
 * ```
 */
export function useGenerateKey(): UseGenerateKeyReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const generate = useCallback(
    async (
      input: GenerateKeyInput,
      depositOptions: Omit<DepositKeyOptions, "key">,
    ): Promise<{ key: DenKey; token: string }> => {
      setIsGenerating(true);
      setError(null);

      try {
        const key = generateKey(input);
        const token = await depositKey({ key, ...depositOptions });
        return { key, token };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate key";
        setError(message);
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  return { generate, isGenerating, error, reset };
}

// ─── useRevokeKey ────────────────────────────────────────────────────────────

interface UseRevokeKeyReturn {
  revoke: (options: RevokeKeyOptions) => Promise<void>;
  isRevoking: boolean;
  error: string | null;
}

/**
 * Hook for the host to revoke a flower pot by token.
 *
 * @example
 * ```tsx
 * const { revoke, isRevoking } = useRevokeKey()
 *
 * <button onClick={() => revoke({
 *   token,
 *   deleteFromServer: (t) => trpc.keys.deleteFlowerPot.mutate({ token: t }),
 * })}>
 *   Revoke
 * </button>
 * ```
 */
export function useRevokeKey(): UseRevokeKeyReturn {
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = useCallback(async (options: RevokeKeyOptions) => {
    setIsRevoking(true);
    setError(null);
    try {
      await revokeKey(options);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to revoke key";
      setError(message);
      throw err;
    } finally {
      setIsRevoking(false);
    }
  }, []);

  return { revoke, isRevoking, error };
}

// ─── useRedeemKey ────────────────────────────────────────────────────────────

interface UseRedeemKeyReturn {
  redeem: (options: RedeemKeyOptions) => Promise<DenKey>;
  isRedeeming: boolean;
  redeemedKey: DenKey | null;
  error: string | null;
  reset: () => void;
}

/**
 * Hook for the visitor to redeem a token and store the resulting DenKey.
 *
 * After successful redemption, the key is stored in localStorage and
 * returned. The visitor can then use the DenKey to initiate a P2P session.
 *
 * @example
 * ```tsx
 * const { redeem, isRedeeming, redeemedKey, error } = useRedeemKey()
 *
 * const handleRedeem = async () => {
 *   const key = await redeem({
 *     token: tokenFromUrl,
 *     visitorSecretKey: myKeyPair.secretKey,
 *     fetchFromServer: (t) => trpc.keys.getFlowerPot.query({ token: t }),
 *   })
 *   // key is now stored in localStorage and available for P2P
 * }
 * ```
 */
export function useRedeemKey(): UseRedeemKeyReturn {
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemedKey, setRedeemedKey] = useState<DenKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setRedeemedKey(null);
  }, []);

  const redeem = useCallback(
    async (options: RedeemKeyOptions): Promise<DenKey> => {
      setIsRedeeming(true);
      setError(null);

      try {
        const key = await redeemKey(options);

        // Persist to localStorage so the visitor retains access across sessions
        const stored: StoredDenKey = {
          key,
          redeemedAt: new Date().toISOString(),
          token: options.token,
        };
        const existing = loadStoredKeys();
        // Replace if already stored for the same keyId
        const updated = [
          ...existing.filter((s) => s.key.keyId !== key.keyId),
          stored,
        ];
        saveStoredKeys(updated);

        setRedeemedKey(key);
        return key;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to redeem key";
        setError(message);
        throw err;
      } finally {
        setIsRedeeming(false);
      }
    },
    [],
  );

  return { redeem, isRedeeming, redeemedKey, error, reset };
}

// ─── useStoredKeys ───────────────────────────────────────────────────────────

interface UseStoredKeysReturn {
  keys: StoredDenKey[];
  removeKey: (keyId: string) => void;
  validKeys: StoredDenKey[];
  expiredKeys: StoredDenKey[];
}

/**
 * Hook for the visitor to read and manage stored DenKeys from localStorage.
 * Automatically filters into valid and expired lists.
 */
export function useStoredKeys(): UseStoredKeysReturn {
  const [keys, setKeys] = useState<StoredDenKey[]>([]);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setKeys(loadStoredKeys());
  }, []);

  const removeKey = useCallback((keyId: string) => {
    setKeys((prev) => {
      const updated = prev.filter((s) => s.key.keyId !== keyId);
      saveStoredKeys(updated);
      // Also remove the key material from sessionStorage.
      const material = loadMaterialMap();
      if (keyId in material) {
        delete material[keyId];
        saveMaterialMap(material);
      }
      return updated;
    });
  }, []);

  const validKeys = keys.filter((s) => validateKey(s.key));
  const expiredKeys = keys.filter((s) => !validateKey(s.key));

  return { keys, removeKey, validKeys, expiredKeys };
}

// ─── useValidateKey ──────────────────────────────────────────────────────────

/**
 * Reactively validates a DenKey. Re-checks every minute so an expiring key
 * becomes invalid in near-real-time without a page reload.
 */
export function useValidateKey(key: DenKey | null): boolean {
  const [isValid, setIsValid] = useState(() =>
    key ? validateKey(key) : false,
  );

  useEffect(() => {
    if (!key) {
      setIsValid(false);
      return;
    }

    setIsValid(validateKey(key));

    // If the key expires in the future, set a re-check timer
    if (key.expiresAt) {
      const ms = new Date(key.expiresAt).getTime() - Date.now();
      if (ms > 0) {
        const interval = setInterval(() => {
          setIsValid(validateKey(key));
        }, 60_000); // check every minute
        return () => clearInterval(interval);
      }
    }
    return undefined;
  }, [key]);

  return isValid;
}
