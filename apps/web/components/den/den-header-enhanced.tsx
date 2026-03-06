"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Crown, Users, BellOff, BookOpen } from "lucide-react";
import { formatFullDate } from "@meerkat/utils/time";
import { SyncStatusBadge, type SyncStatus } from "@meerkat/ui";
import type { Den } from "@/types/den";

interface DenHeaderEnhancedProps {
  den: Den;
  memberCount: number;
  isOwner: boolean;
  muted: boolean;
  onMembersClick: () => void;
  syncStatus?: SyncStatus;
  visitorCount?: number;
}

export function DenHeaderEnhanced({
  den,
  memberCount,
  isOwner,
  muted,
  onMembersClick,
  syncStatus = "offline",
  visitorCount = 0,
}: DenHeaderEnhancedProps) {
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
        <SyncStatusBadge
          status={syncStatus}
          showLabel={true}
          showTooltip={true}
          visitorCount={visitorCount}
          className="text-xs"
        />
        <Link
          href={`/dens/${den.id}/burrows`}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70"
          style={{
            background: "rgba(138,96,53,0.08)",
            color: "var(--color-text-muted)",
          }}
        >
          <BookOpen className="h-3 w-3" />
          Burrows
        </Link>
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
