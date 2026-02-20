"use client";

import { DensGrid } from "@/components/home/dens-grid";

interface DensSectionProps {
  userId: string;
}

/**
 * Thin wrapper — dens fetching and rendering is delegated to DensGrid
 * which uses TanStack Query internally. Online counts per den come from
 * the shared usePresenceStore updated by useDenPresence inside each den page.
 */
export function DensSection({ userId }: DensSectionProps) {
  return <DensGrid userId={userId} />;
}
