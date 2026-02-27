"use client";

import { VisitorPresenceList, type VisitorInfo } from "@meerkat/ui";
import { useFeature } from "@/lib/feature-flags-context";
import { useHostStatus } from "@meerkat/p2p";
import type { PresenceInfo, SyncStatus } from "@meerkat/crdt";

interface VisitorPanelProps {
  denId: string;
  /** Authoritative sync status from DenContext (properly wired via DenSyncMachine). */
  syncStatus: SyncStatus;
  visitors: PresenceInfo[];
  canDisconnect?: boolean;
  onDisconnectVisitor?: (visitorId: string) => void;
}

/**
 * Visitor Panel Component
 *
 * Displays connected visitors and Start/Stop hosting controls for the den owner.
 *
 * syncStatus is passed in from denContext (correctly propagated by DenSyncMachine)
 * rather than read from useHostStatus, which has a stale-subscription problem when
 * the HostManager is created after the hook mounts. useHostStatus is used only for
 * its startHosting / stopHosting action callbacks.
 */
export function VisitorPanel({
  denId,
  syncStatus,
  visitors,
  canDisconnect = false,
  onDisconnectVisitor,
}: VisitorPanelProps) {
  const showNewUI = useFeature("newUI");
  // Only used for startHosting / stopHosting — NOT for the status display.
  const { startHosting, stopHosting } = useHostStatus(denId);

  if (!showNewUI) {
    return null;
  }

  // Transform PresenceInfo to VisitorInfo
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

  return (
    <div className="mb-6">
      {/* Start/Stop hosting controls (owner only) */}
      {canDisconnect && (
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {syncStatus === "hosting"
              ? `${visitors.length} visitor${visitors.length !== 1 ? "s" : ""} connected`
              : syncStatus === "connecting" || syncStatus === "synced"
                ? "Waiting for visitors…"
                : "Not hosting"}
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
      )}

      {/* Visitor list */}
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
