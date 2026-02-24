/**
 * VisitorPresenceList - Displays currently connected visitors
 *
 * Shows a list of visitors connected via P2P WebRTC with:
 * - Avatar/initials
 * - Name or ID
 * - Connection status indicator
 * - Optional disconnect button (host only)
 *
 * @example
 * ```tsx
 * import { VisitorPresenceList } from '@meerkat/ui';
 *
 * function DenSidebar({ visitors, isHost, onDisconnect }) {
 *   return (
 *     <aside>
 *       <h2>Visitors</h2>
 *       <VisitorPresenceList
 *         visitors={visitors}
 *         canDisconnect={isHost}
 *         onDisconnectVisitor={onDisconnect}
 *       />
 *     </aside>
 *   );
 * }
 * ```
 */

import * as React from "react";
import { X, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { Button } from "./button";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VisitorInfo {
  /**
   * Unique visitor ID
   */
  visitorId: string;
  /**
   * Display name (optional)
   */
  name?: string;
  /**
   * Avatar URL (optional)
   */
  avatarUrl?: string;
  /**
   * When the visitor connected (ISO-8601)
   */
  connectedAt: string;
  /**
   * Access scope (come-over, peek, house-sit, etc.)
   */
  scope?: {
    read: boolean;
    write: boolean;
    offline: boolean;
  };
  /**
   * Last seen timestamp (for presence staleness check)
   */
  lastSeenAt?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface VisitorPresenceListProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * List of currently connected visitors
   */
  visitors: VisitorInfo[];
  /**
   * Whether the current user can disconnect visitors (host only)
   * @default false
   */
  canDisconnect?: boolean;
  /**
   * Callback when disconnect button is clicked
   */
  onDisconnectVisitor?: (visitorId: string) => void;
  /**
   * Show connection time
   * @default true
   */
  showConnectionTime?: boolean;
  /**
   * Maximum number of visitors to show before collapsing
   * @default undefined (show all)
   */
  maxVisible?: number;
  /**
   * Empty state message
   * @default "No visitors connected"
   */
  emptyMessage?: string;
}

const VisitorPresenceList = React.forwardRef<
  HTMLDivElement,
  VisitorPresenceListProps
>(
  (
    {
      visitors,
      canDisconnect = false,
      onDisconnectVisitor,
      showConnectionTime = true,
      maxVisible,
      emptyMessage = "No visitors connected",
      className,
      ...props
    },
    ref,
  ) => {
    const [expanded, setExpanded] = React.useState(false);

    const visibleVisitors =
      maxVisible && !expanded ? visitors.slice(0, maxVisible) : visitors;
    const hiddenCount =
      maxVisible && !expanded ? visitors.length - maxVisible : 0;

    if (visitors.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex items-center justify-center p-6 text-sm text-gray-500 dark:text-gray-400",
            className,
          )}
          {...props}
        >
          {emptyMessage}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2", className)}
        role="list"
        aria-label="Connected visitors"
        {...props}
      >
        <AnimatePresence mode="popLayout">
          {visibleVisitors.map((visitor) => (
            <motion.div
              key={visitor.visitorId}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              role="listitem"
            >
              <VisitorCard
                visitor={visitor}
                canDisconnect={canDisconnect}
                onDisconnect={onDisconnectVisitor}
                showConnectionTime={showConnectionTime}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors text-left p-2"
          >
            {expanded
              ? "Show less"
              : `+ ${hiddenCount} more visitor${hiddenCount > 1 ? "s" : ""}`}
          </button>
        )}
      </div>
    );
  },
);

VisitorPresenceList.displayName = "VisitorPresenceList";

// ─── VisitorCard (Internal) ───────────────────────────────────────────────────

interface VisitorCardProps {
  visitor: VisitorInfo;
  canDisconnect: boolean;
  onDisconnect?: (visitorId: string) => void;
  showConnectionTime: boolean;
}

function VisitorCard({
  visitor,
  canDisconnect,
  onDisconnect,
  showConnectionTime,
}: VisitorCardProps) {
  const { visitorId, name, avatarUrl, connectedAt, scope } = visitor;

  // Get initials from name or use first 2 chars of ID
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : visitorId.slice(0, 2).toUpperCase();

  // Format connection time
  const connectedDate = new Date(connectedAt);
  const now = new Date();
  const diffMs = now.getTime() - connectedDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  let timeLabel = "";
  if (diffMins < 1) {
    timeLabel = "Just now";
  } else if (diffMins < 60) {
    timeLabel = `${diffMins}m ago`;
  } else {
    const diffHours = Math.floor(diffMins / 60);
    timeLabel = `${diffHours}h ago`;
  }

  // Determine if read-only
  const isReadOnly = scope && scope.read && !scope.write;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl",
        "bg-gray-50 dark:bg-gray-800/50",
        "border border-gray-200 dark:border-gray-700",
        "hover:border-gray-300 dark:hover:border-gray-600",
        "transition-colors",
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name || visitorId}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
        )}
        {/* Online indicator */}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-gray-800 rounded-full"
          aria-label="Online"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {name || `Visitor ${visitorId.slice(0, 6)}`}
          </p>
          {isReadOnly && (
            <span
              className="text-gray-400 flex-shrink-0"
              title="Read-only access"
            >
              <Shield size={12} aria-hidden="true" />
            </span>
          )}
        </div>
        {showConnectionTime && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {timeLabel}
          </p>
        )}
      </div>
      {/* Disconnect button */}
      {canDisconnect && onDisconnect && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          onClick={() => onDisconnect(visitorId)}
          aria-label={`Disconnect ${name || visitorId}`}
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}

export { VisitorPresenceList };
