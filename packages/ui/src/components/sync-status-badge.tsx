/**
 * SyncStatusBadge - Displays the current P2P sync status
 *
 * Shows the connection state with appropriate icon and color:
 * - offline: Gray with cloud-off icon
 * - connecting: Yellow with loader icon (animated)
 * - synced: Green with wifi icon
 * - hosting: Blue with users icon
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
import { cva, type VariantProps } from "class-variance-authority";
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

// ─── Variants ─────────────────────────────────────────────────────────────────

const syncStatusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
  {
    variants: {
      status: {
        offline:
          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        connecting:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        synced:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        hosting:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5 gap-1",
        default: "text-xs px-2.5 py-1 gap-1.5",
        lg: "text-sm px-3 py-1.5 gap-2",
      },
    },
    defaultVariants: {
      status: "offline",
      size: "default",
    },
  },
);

// ─── Component ────────────────────────────────────────────────────────────────

export interface SyncStatusBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof syncStatusBadgeVariants> {
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
}

const SyncStatusBadge = React.forwardRef<HTMLDivElement, SyncStatusBadgeProps>(
  (
    {
      status,
      showLabel = true,
      showTooltip = true,
      visitorCount,
      size,
      className,
      ...props
    },
    ref,
  ) => {
    const config = syncStatusConfig[status];
    const Icon = config.icon;
    const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;

    const label =
      status === "hosting" && visitorCount !== undefined && visitorCount > 0
        ? `${config.label} (${visitorCount})`
        : config.label;

    return (
      <div
        ref={ref}
        className={cn(syncStatusBadgeVariants({ status, size }), className)}
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

export { SyncStatusBadge, syncStatusBadgeVariants };
