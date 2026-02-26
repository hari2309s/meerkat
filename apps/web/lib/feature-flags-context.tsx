"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  type FeatureFlags,
  getFeatureFlags,
  setFeatureFlags as saveFeatureFlags,
  resetFeatureFlags as clearFeatureFlags,
} from "./feature-flags";

interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  setFlags: (flags: Partial<FeatureFlags>) => void;
  resetFlags: () => void;
  isEnabled: (feature: keyof FeatureFlags) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(
  undefined,
);

export function FeatureFlagsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flags, setFlagsState] = useState<FeatureFlags>(getFeatureFlags);
  const [mounted, setMounted] = useState(false);

  // Read from localStorage after mount (client-side only)
  useEffect(() => {
    setMounted(true);
    setFlagsState(getFeatureFlags());
  }, []);

  // Sync with localStorage changes (for multi-tab support)
  useEffect(() => {
    if (!mounted) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "meerkat:feature-flags" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as FeatureFlags;
          setFlagsState(parsed);
        } catch (error) {
          console.warn(
            "Failed to parse feature flags from storage event:",
            error,
          );
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [mounted]);

  const setFlags = (newFlags: Partial<FeatureFlags>) => {
    saveFeatureFlags(newFlags);
    setFlagsState((prev) => ({ ...prev, ...newFlags }));
  };

  const resetFlags = () => {
    clearFeatureFlags();
    setFlagsState(getFeatureFlags());
  };

  const isEnabled = (feature: keyof FeatureFlags) => {
    return flags[feature];
  };

  return (
    <FeatureFlagsContext.Provider
      value={{ flags, setFlags, resetFlags, isEnabled }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Hook to access feature flags
 */
export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagsProvider",
    );
  }
  return context;
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useFeature(feature: keyof FeatureFlags): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(feature);
}
