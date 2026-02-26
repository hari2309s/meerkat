"use client";

import React, { type ReactNode } from "react";
import { DenProvider as CRDTDenProvider } from "@meerkat/crdt";
import { useFeature } from "@/lib/feature-flags-context";

interface DenProviderProps {
  denId: string;
  children: ReactNode;
  readOnly?: boolean;
}

/**
 * Hybrid Den Provider
 *
 * This provider conditionally uses the new local-first CRDT architecture
 * based on the localFirstStorage feature flag.
 *
 * When localFirstStorage is enabled:
 *   - Uses @meerkat/crdt DenProvider with IndexedDB + Yjs
 *   - Enables offline-first storage and P2P sync
 *
 * When localFirstStorage is disabled:
 *   - Children render normally without den context
 *   - Falls back to legacy tRPC-based data fetching (if still present)
 *
 * This allows gradual migration from the old architecture to the new one.
 */
export function DenProvider({
  denId,
  children,
  readOnly = false,
}: DenProviderProps) {
  const useLocalFirst = useFeature("localFirstStorage");

  // New architecture: local-first CRDT
  if (useLocalFirst) {
    return (
      <CRDTDenProvider denId={denId} readOnly={readOnly}>
        {children}
      </CRDTDenProvider>
    );
  }

  // Legacy architecture: children render without den context
  // The page components will use tRPC queries directly
  return <>{children}</>;
}
