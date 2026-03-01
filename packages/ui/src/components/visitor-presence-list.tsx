"use client";

import * as React from "react";
import { X, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

export interface VisitorInfo {
  visitorId: string;
  name?: string;
  avatarUrl?: string;
  connectedAt: string;
  scope?: {
    read: boolean;
    write: boolean;
    offline: boolean;
  };
  lastSeenAt?: number;
}

export interface VisitorPresenceListProps extends React.HTMLAttributes<HTMLDivElement> {
  visitors: VisitorInfo[];
  canDisconnect?: boolean;
  onDisconnectVisitor?: (visitorId: string) => void;
  showConnectionTime?: boolean;
  maxVisible?: number;
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
          className={cn("flex items-center p-2 text-sm", className)}
          style={{ color: "var(--color-text-muted)" }}
          {...props}
        >
          {emptyMessage}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1", className)}
        role="list"
        aria-label="Connected visitors"
        {...props}
      >
        <AnimatePresence mode="popLayout">
          {visibleVisitors.map((visitor) => (
            <motion.div
              key={visitor.visitorId}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
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
            className="text-xs transition-opacity hover:opacity-70 text-left px-2 py-1"
            style={{ color: "var(--color-text-muted)" }}
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

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : visitorId.slice(0, 2).toUpperCase();

  const diffMs = Date.now() - new Date(connectedAt).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const timeLabel =
    diffMins < 1
      ? "Just now"
      : diffMins < 60
        ? `${diffMins}m ago`
        : `${Math.floor(diffMins / 60)}h ago`;

  const isReadOnly = scope && scope.read && !scope.write;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
      style={{
        background: "var(--color-surface-raised, rgba(138,96,53,0.06))",
      }}
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
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ background: "var(--color-accent, #8a6035)" }}
          >
            {initials}
          </div>
        )}
        {/* Online dot */}
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
          style={{
            background: "#22c55e",
            borderColor: "var(--color-bg, #fff)",
          }}
          aria-label="Online"
        />
      </div>

      {/* Name + time */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className="text-sm font-medium truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {name || `Visitor ${visitorId.slice(0, 6)}`}
          </p>
          {isReadOnly && (
            <span
              style={{ color: "var(--color-text-muted)" }}
              title="Read-only access"
            >
              <Shield size={11} aria-hidden="true" />
            </span>
          )}
        </div>
        {showConnectionTime && (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {timeLabel}
          </p>
        )}
      </div>

      {/* Disconnect */}
      {canDisconnect && onDisconnect && (
        <button
          onClick={() => onDisconnect(visitorId)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg opacity-40 hover:opacity-100 transition-opacity"
          style={{ color: "var(--color-text-secondary)" }}
          aria-label={`Disconnect ${name || visitorId}`}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export { VisitorPresenceList };
