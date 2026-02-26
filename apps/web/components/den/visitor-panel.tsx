"use client";

import { VisitorPresenceList, type VisitorInfo } from "@meerkat/ui";
import { useFeature } from "@/lib/feature-flags-context";
import type { PresenceInfo } from "@meerkat/crdt";

interface VisitorPanelProps {
  visitors: PresenceInfo[];
  canDisconnect?: boolean;
  onDisconnectVisitor?: (visitorId: string) => void;
}

/**
 * Visitor Panel Component
 *
 * Displays connected visitors using the VisitorPresenceList component
 * from @meerkat/ui when the newUI feature flag is enabled.
 *
 * When disabled, returns null (no visitor display).
 */
export function VisitorPanel({
  visitors,
  canDisconnect = false,
  onDisconnectVisitor,
}: VisitorPanelProps) {
  const showNewUI = useFeature("newUI");

  if (!showNewUI || visitors.length === 0) {
    return null;
  }

  // Transform PresenceInfo to VisitorInfo
  const visitorInfos: VisitorInfo[] = visitors.map((v) => ({
    visitorId: v.visitorId,
    name: v.displayName,
    avatarUrl: undefined, // TODO: Add avatar support
    connectedAt: new Date(v.connectedAt).toISOString(),
    scope: {
      read: v.scopes.length > 0, // Has access if any scopes are granted
      write: v.scopes.includes("write"),
      offline: v.scopes.includes("offline"),
    },
    lastSeenAt: v.lastSeenAt,
  }));

  return (
    <div className="mb-6">
      <VisitorPresenceList
        visitors={visitorInfos}
        canDisconnect={canDisconnect}
        onDisconnectVisitor={onDisconnectVisitor}
        showConnectionTime={true}
        maxVisible={5}
        emptyMessage="No visitors connected"
      />
    </div>
  );
}
