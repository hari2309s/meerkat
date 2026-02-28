/**
 * Feature Flags for Gradual Migration to Local-First Architecture
 *
 * This file defines feature flags that control the rollout of the new
 * local-first P2P sync architecture. Flags can be toggled individually
 * to enable/disable features during the migration process.
 */

export interface FeatureFlags {
  /**
   * Enable local-first storage (IndexedDB + Yjs CRDTs)
   * When false, falls back to tRPC-based server storage
   */
  localFirstStorage: boolean;

  /**
   * Enable P2P sync functionality (WebRTC direct connections)
   * Requires localFirstStorage to be true
   */
  p2pSync: boolean;

  /**
   * Enable on-device voice transcription and mood analysis
   * When false, voice memos are stored but not analyzed
   */
  voiceAnalysis: boolean;

  /**
   * Show new UI components (SyncStatusBadge, VisitorPresenceList, etc.)
   * When false, uses legacy UI
   */
  newUI: boolean;

  /**
   * Enable end-to-end encryption for all content
   * When false, content is stored unencrypted (dev only)
   */
  encryption: boolean;
}

/**
 * Default feature flag values
 * All local-first features are on by default.
 * Override with NEXT_PUBLIC_FF_* env vars or localStorage to opt out.
 */
export const defaultFeatureFlags: FeatureFlags = {
  localFirstStorage: true,
  p2pSync: true,
  voiceAnalysis: true,
  newUI: true,
  encryption: true,
};

/**
 * Apply env var overrides to a flags object.
 * An env var only overrides the default when it is explicitly set to "true" or "false".
 * Unset variables leave the default intact.
 */
function applyEnvOverrides(flags: FeatureFlags): FeatureFlags {
  const result = { ...flags };
  const {
    NEXT_PUBLIC_FF_LOCAL_FIRST,
    NEXT_PUBLIC_FF_P2P_SYNC,
    NEXT_PUBLIC_FF_VOICE_ANALYSIS,
    NEXT_PUBLIC_FF_NEW_UI,
    NEXT_PUBLIC_FF_ENCRYPTION,
  } = process.env;

  if (NEXT_PUBLIC_FF_LOCAL_FIRST !== undefined)
    result.localFirstStorage = NEXT_PUBLIC_FF_LOCAL_FIRST === "true";
  if (NEXT_PUBLIC_FF_P2P_SYNC !== undefined)
    result.p2pSync = NEXT_PUBLIC_FF_P2P_SYNC === "true";
  if (NEXT_PUBLIC_FF_VOICE_ANALYSIS !== undefined)
    result.voiceAnalysis = NEXT_PUBLIC_FF_VOICE_ANALYSIS === "true";
  if (NEXT_PUBLIC_FF_NEW_UI !== undefined)
    result.newUI = NEXT_PUBLIC_FF_NEW_UI === "true";
  if (NEXT_PUBLIC_FF_ENCRYPTION !== undefined)
    result.encryption = NEXT_PUBLIC_FF_ENCRYPTION !== "false";

  return result;
}

/**
 * Get feature flags from environment variables or localStorage
 * Priority: localStorage > env vars > defaults
 */
export function getFeatureFlags(): FeatureFlags {
  // Start with defaults, then apply any explicit env var overrides
  const base = applyEnvOverrides(defaultFeatureFlags);

  // Server-side: env overrides only (no localStorage)
  if (typeof window === "undefined") {
    return base;
  }

  // Client-side: localStorage takes highest priority
  try {
    const stored = localStorage.getItem("meerkat:feature-flags");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<FeatureFlags>;
      return { ...base, ...parsed };
    }
  } catch (error) {
    console.warn("Failed to parse feature flags from localStorage:", error);
  }

  return base;
}

/**
 * Save feature flags to localStorage (client-side only)
 */
export function setFeatureFlags(flags: Partial<FeatureFlags>): void {
  if (typeof window === "undefined") {
    console.warn("Cannot set feature flags on server side");
    return;
  }

  const current = getFeatureFlags();
  const updated = { ...current, ...flags };

  try {
    localStorage.setItem("meerkat:feature-flags", JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save feature flags to localStorage:", error);
  }
}

/**
 * Reset feature flags to defaults (client-side only)
 */
export function resetFeatureFlags(): void {
  if (typeof window === "undefined") {
    console.warn("Cannot reset feature flags on server side");
    return;
  }

  try {
    localStorage.removeItem("meerkat:feature-flags");
  } catch (error) {
    console.error("Failed to reset feature flags:", error);
  }
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}
