/**
 * Feature Flags — permanently enabled.
 *
 * Migration to local-first architecture is complete. All flags are hardcoded
 * to true. The types/functions are kept so existing call-sites compile without
 * changes, but nothing reads from env vars or localStorage anymore.
 */

export interface FeatureFlags {
  localFirstStorage: boolean;
  p2pSync: boolean;
  voiceAnalysis: boolean;
  newUI: boolean;
  encryption: boolean;
}

export const defaultFeatureFlags: FeatureFlags = {
  localFirstStorage: true,
  p2pSync: true,
  voiceAnalysis: true,
  newUI: true,
  encryption: true,
};

export function getFeatureFlags(): FeatureFlags {
  return { ...defaultFeatureFlags };
}

/** No-op — flags are no longer persisted. */
export function setFeatureFlags(_flags: Partial<FeatureFlags>): void {}

/** No-op — flags are no longer persisted. */
export function resetFeatureFlags(): void {}

export function isFeatureEnabled(_feature: keyof FeatureFlags): boolean {
  return true;
}
