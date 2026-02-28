/**
 * SyncStatusBadge - Displays the current P2P sync status
 *
 * Shows the connection state with appropriate icon and color:
 * - offline: Gray / muted tone
 * - connecting: Amber / warm yellow
 * - synced: Teal / meerkat green
 * - hosting: Meerkat brown / active
 *
 * @example
 * ```tsx
 * import { SyncStatusBadge } from '@meerkat/ui';
 *
 * function DenHeader({ syncStatus }: { syncStatus: SyncStatus }) {
 *   return (
 *     <div>
 *       <h1>My Den</h1>
 *       <SyncStatusBadge status={syncStatus} />
 *     </div>
 *   );
 * }
 * ```
 */

import * as React from "react";
import { CloudOff, Loader2, Wifi, Users } from "lucide-react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = "offline" | "connecting" | "synced" | "hosting";

const syncStatusConfig = {
  offline: {
    label: "Offline",
    icon: CloudOff,
    description: "No connection",
  },
  connecting: {
    label: "Connecting",
    icon: Loader2,
    description: "Establishing connection",
  },
  synced: {
    label: "Synced",
    icon: Wifi,
    description: "Connected and synced",
  },
  hosting: {
    label: "Hosting",
    icon: Users,
    description: "Hosting visitors",
  },
} as const;

// ─── Per-status style tokens (use CSS vars so light + dark both work) ─────────

const STATUS_STYLES: Record<SyncStatus, { background: string; color: string }> =
  {
    offline: {
      background: "rgba(120, 85, 53, 0.08)",
      color: "var(--color-text-muted)",
    },
    connecting: {
      // warm amber — readable in both modes
      background: "rgba(180, 120, 30, 0.12)",
      color: "var(--color-text-secondary)",
    },
    synced: {
      background: "var(--color-synced-bg)",
      color: "var(--color-synced-text)",
    },
    hosting: {
      background: "var(--color-selection-active-bg)",
      color: "var(--color-selection-active-text)",
    },
  };

// Dark-mode overrides injected via a data attribute on <html> — instead we rely
// on CSS custom properties which already switch between :root and .dark. The
// only exception is the teal `synced` colour which has no variable yet, so we
// patch it via a local style tag approach-free inline solution: the synced
// colour uses rgba with moderate opacity, which reads well on both the warm
// sand light background (#f5e6d3) and the near-black dark background (#180e06).

// ─── Component ────────────────────────────────────────────────────────────────

export interface SyncStatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Current sync status
   */
  status: SyncStatus;
  /**
   * Show status label text
   * @default true
   */
  showLabel?: boolean;
  /**
   * Show tooltip on hover
   * @default true
   */
  showTooltip?: boolean;
  /**
   * Number of visitors (only shown when status is 'hosting')
   */
  visitorCount?: number;
  /**
   * Badge size
   */
  size?: "sm" | "default" | "lg";
}

const SyncStatusBadge = React.forwardRef<HTMLDivElement, SyncStatusBadgeProps>(
  (
    {
      status,
      showLabel = true,
      showTooltip = true,
      visitorCount,
      size = "default",
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const config = syncStatusConfig[status];
    const Icon = config.icon;
    const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;

    const label =
      status === "hosting" && visitorCount !== undefined && visitorCount > 0
        ? `${visitorCount} visitor${visitorCount !== 1 ? "s" : ""}`
        : config.label;

    const sizeClasses =
      size === "sm"
        ? "text-[10px] px-2 py-0.5 gap-1"
        : size === "lg"
          ? "text-sm px-3 py-1.5 gap-2"
          : "text-xs px-2.5 py-1 gap-1.5";

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium transition-all",
          sizeClasses,
          className,
        )}
        style={{
          ...STATUS_STYLES[status],
          ...style,
        }}
        title={showTooltip ? config.description : undefined}
        role="status"
        aria-label={`Sync status: ${label}`}
        {...props}
      >
        <Icon
          size={iconSize}
          className={cn(
            status === "connecting" && "animate-spin",
            "flex-shrink-0",
          )}
          aria-hidden="true"
        />
        {showLabel && <span>{label}</span>}
      </div>
    );
  },
);

SyncStatusBadge.displayName = "SyncStatusBadge";

export { SyncStatusBadge };
