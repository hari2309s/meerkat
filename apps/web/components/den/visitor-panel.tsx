"use client";

import { useHostStatus } from "@meerkat/p2p";
import type { PresenceInfo, SyncStatus } from "@meerkat/crdt";

interface VisitorPanelProps {
  denId: string;
  syncStatus: SyncStatus;
  visitors: PresenceInfo[];
  canDisconnect?: boolean;
}

export function VisitorPanel({
  denId,
  syncStatus,
  visitors,
  canDisconnect = false,
}: VisitorPanelProps) {
  const { startHosting, stopHosting } = useHostStatus(denId);
  const isHosting = syncStatus !== "offline";

  return (
    <div className="mb-6">
      {/* Owner: status text + start/stop hosting button */}
      {canDisconnect && (
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {visitors.length > 0
              ? `${visitors.length} visitor${visitors.length !== 1 ? "s" : ""} connected`
              : isHosting
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
    </div>
  );
}
