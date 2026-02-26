"use client";

import { motion } from "framer-motion";
import { Crown, Users, BellOff } from "lucide-react";
import { formatFullDate } from "@meerkat/utils/time";
import { SyncStatusBadge, type SyncStatus } from "@meerkat/ui";
import { useFeature } from "@/lib/feature-flags-context";
import { useState, useEffect } from "react";
import type { Den } from "@/types/den";

interface DenHeaderEnhancedProps {
  den: Den;
  memberCount: number;
  isOwner: boolean;
  muted: boolean;
  onMembersClick: () => void;
  // New local-first props
  syncStatus?: SyncStatus;
  visitorCount?: number;
}

/**
 * Enhanced Den Header with Local-First UI Components
 *
 * When the newUI feature flag is enabled, this component displays:
 * - SyncStatusBadge showing P2P sync status
 * - Visitor count for hosting mode
 *
 * When the feature flag is disabled, it shows the legacy UI.
 */
export function DenHeaderEnhanced({
  den,
  memberCount,
  isOwner,
  muted,
  onMembersClick,
  syncStatus = "offline",
  visitorCount = 0,
}: DenHeaderEnhancedProps) {
  const showNewUI = useFeature("newUI");
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering feature-flag-dependent UI after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-10"
    >
      <h1
        className="text-3xl font-bold"
        style={{ color: "var(--color-text-primary)" }}
      >
        {den.name}
      </h1>
      <div
        className="mt-1.5 text-sm flex items-center flex-wrap gap-2"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span>Created on {formatFullDate(den.created_at)}</span>
        {isOwner && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: "rgba(138,96,53,0.12)",
              color: "var(--color-text-secondary)",
            }}
          >
            <Crown className="h-3 w-3" />
            Owner
          </span>
        )}
        <button
          onClick={onMembersClick}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70"
          style={{
            background: "rgba(138,96,53,0.08)",
            color: "var(--color-text-muted)",
          }}
        >
          <Users className="h-3 w-3" />
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </button>
        {/* New UI: Show SyncStatusBadge when feature flag is enabled */}
        {mounted && showNewUI && (
          <SyncStatusBadge
            status={syncStatus}
            showLabel={true}
            showTooltip={true}
            visitorCount={visitorCount}
            className="text-xs"
          />
        )}
        {muted && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: "rgba(100,100,100,0.1)",
              color: "var(--color-text-muted)",
            }}
          >
            <BellOff className="h-3 w-3" />
            Muted
          </span>
        )}
      </div>
    </motion.div>
  );
}
