"use client";

import { VisitorPresenceList, type VisitorInfo } from "@meerkat/ui";
import { useFeature } from "@/lib/feature-flags-context";
import { useHostStatus } from "@meerkat/p2p";
import type { PresenceInfo, SyncStatus } from "@meerkat/crdt";

interface VisitorPanelProps {
  denId: string;
  syncStatus: SyncStatus;
  visitors: PresenceInfo[];
  canDisconnect?: boolean;
  onDisconnectVisitor?: (visitorId: string) => void;
}

export function VisitorPanel({
  denId,
  syncStatus,
  visitors,
  canDisconnect = false,
  onDisconnectVisitor,
}: VisitorPanelProps) {
  const showNewUI = useFeature("newUI");
  const { startHosting, stopHosting } = useHostStatus(denId);

  // Only render for owners (canDisconnect === true means owner)
  // Visitors should never see this panel
  if (!showNewUI || !canDisconnect) {
    return null;
  }

  const visitorInfos: VisitorInfo[] = visitors.map((v) => ({
    visitorId: v.visitorId,
    name: v.displayName,
    avatarUrl: undefined,
    connectedAt: new Date(v.connectedAt).toISOString(),
    scope: {
      read: v.scopes.length > 0,
      write: v.scopes.includes("write"),
      offline: v.scopes.includes("offline"),
    },
    lastSeenAt: v.lastSeenAt,
  }));

  const isHosting = syncStatus !== "offline";

  const statusText =
    visitors.length > 0
      ? `${visitors.length} visitor${visitors.length !== 1 ? "s" : ""} connected`
      : syncStatus === "connecting" ||
          syncStatus === "synced" ||
          syncStatus === "hosting"
        ? "Waiting for visitors…"
        : "Not hosting";

  return (
    <div className="mb-6">
      {/* Status row + stop/start button — always shown for owner */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          {statusText}
        </span>
        <button
          onClick={isHosting ? stopHosting : startHosting}
          className="text-xs font-medium px-3 py-1 rounded-lg transition-opacity hover:opacity-75"
          style={
            isHosting
              ? { background: "rgba(192,57,43,0.10)", color: "#c0392b" }
              : {
                  background: "rgba(138,96,53,0.10)",
                  color: "var(--color-text-secondary)",
                }
          }
        >
          {isHosting ? "Stop hosting" : "Start hosting"}
        </button>
      </div>

      {/* Visitor list — only shown when visitors are actually connected */}
      {visitorInfos.length > 0 && (
        <VisitorPresenceList
          visitors={visitorInfos}
          canDisconnect={canDisconnect}
          onDisconnectVisitor={onDisconnectVisitor}
          showConnectionTime={true}
          maxVisible={5}
          emptyMessage="No visitors connected"
        />
      )}
    </div>
  );
}
