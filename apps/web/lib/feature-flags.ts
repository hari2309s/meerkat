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
 * Start with all flags disabled for safe migration
 */
export const defaultFeatureFlags: FeatureFlags = {
  localFirstStorage: false,
  p2pSync: false,
  voiceAnalysis: false,
  newUI: false,
  encryption: true, // Always keep encryption enabled by default for security
};

/**
 * Get feature flags from environment variables or localStorage
 * Priority: localStorage > env vars > defaults
 */
export function getFeatureFlags(): FeatureFlags {
  // Start with defaults
  const flags = { ...defaultFeatureFlags };

  // Server-side: check environment variables
  if (typeof window === "undefined") {
    flags.localFirstStorage = process.env.NEXT_PUBLIC_FF_LOCAL_FIRST === "true";
    flags.p2pSync = process.env.NEXT_PUBLIC_FF_P2P_SYNC === "true";
    flags.voiceAnalysis = process.env.NEXT_PUBLIC_FF_VOICE_ANALYSIS === "true";
    flags.newUI = process.env.NEXT_PUBLIC_FF_NEW_UI === "true";
    flags.encryption = process.env.NEXT_PUBLIC_FF_ENCRYPTION !== "false";
    return flags;
  }

  // Client-side: check localStorage (overrides env vars)
  try {
    const stored = localStorage.getItem("meerkat:feature-flags");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<FeatureFlags>;
      return { ...flags, ...parsed };
    }
  } catch (error) {
    console.warn("Failed to parse feature flags from localStorage:", error);
  }

  // Fallback to environment variables on client
  flags.localFirstStorage = process.env.NEXT_PUBLIC_FF_LOCAL_FIRST === "true";
  flags.p2pSync = process.env.NEXT_PUBLIC_FF_P2P_SYNC === "true";
  flags.voiceAnalysis = process.env.NEXT_PUBLIC_FF_VOICE_ANALYSIS === "true";
  flags.newUI = process.env.NEXT_PUBLIC_FF_NEW_UI === "true";
  flags.encryption = process.env.NEXT_PUBLIC_FF_ENCRYPTION !== "false";

  return flags;
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
