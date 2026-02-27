"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Inbox, ArrowRight, Trash2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SectionCard } from "@/components/settings/shared";
import { relativeTime } from "@meerkat/utils/time";
import { dropStoragePrefix } from "@meerkat/p2p";

interface PendingDrop {
  path: string;
  denId: string;
  denName: string;
  droppedAt: string;
  visitorId: string;
}

interface OwnedDen {
  id: string;
  name: string;
}

/**
 * DropboxSection
 *
 * Shows pending Letterbox drops left by visitors while the host was offline.
 * Drops are stored in Supabase Storage at: drops/{denId}/{visitorId}-{dropId}.enc
 *
 * Navigate to a den to auto-collect and decrypt pending drops. From here
 * the host can also clear individual drops without importing them.
 */
export function DropboxSection({ userId }: { userId: string }) {
  return (
    <>
      <PendingDropsCard userId={userId} />
      <HowItWorksCard />
    </>
  );
}

// ── Pending drops card ────────────────────────────────────────────────────────

function PendingDropsCard({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [drops, setDrops] = useState<PendingDrop[]>([]);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const fetchDrops = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // 1. Fetch owned dens (the current user is host)
      const { data: dens, error: densErr } = await supabase
        .from("dens")
        .select("id, name")
        .eq("user_id", userId);

      if (densErr) throw densErr;
      if (!dens || dens.length === 0) {
        setDrops([]);
        return;
      }

      // 2. For each den, list drops from Supabase Storage
      const allDrops: PendingDrop[] = [];

      for (const den of dens as OwnedDen[]) {
        const prefix = dropStoragePrefix(den.id);
        const { data: files, error: listErr } = await supabase.storage
          .from("blobs")
          .list(prefix, { limit: 100 });

        if (listErr || !files) continue;

        for (const file of files) {
          // Parse visitorId from filename: {visitorId}-{dropId}.enc
          const withoutExt = file.name.replace(/\.enc$/, "");
          const dashIdx = withoutExt.lastIndexOf("-");
          const visitorId =
            dashIdx > 0 ? withoutExt.slice(0, dashIdx) : withoutExt;

          allDrops.push({
            path: `${prefix}${file.name}`,
            denId: den.id,
            denName: den.name,
            // file.created_at may be undefined, fall back to now
            droppedAt:
              (file as { created_at?: string }).created_at ??
              new Date().toISOString(),
            visitorId,
          });
        }
      }

      setDrops(allDrops);
    } catch (err) {
      toast.error("Could not load pending drops", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDrops();
  }, [fetchDrops]);

  const handleDelete = async (path: string) => {
    setDeletingPath(path);
    try {
      const supabase = createClient();
      const { error } = await supabase.storage.from("blobs").remove([path]);
      if (error) throw error;
      setDrops((prev) => prev.filter((d) => d.path !== path));
      toast.success("Drop discarded");
    } catch (err) {
      toast.error("Could not discard drop", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setDeletingPath(null);
    }
  };

  const handleGoToDen = (denId: string) => {
    router.push(`/dens/${denId}`);
  };

  return (
    <SectionCard
      title="Pending drops"
      subtitle="Encrypted messages left by visitors while you were offline"
    >
      {/* Refresh button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={fetchDrops}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity hover:opacity-75 disabled:opacity-50"
          style={{
            background: "rgba(138,96,53,0.08)",
            color: "var(--color-text-secondary)",
          }}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center py-8 gap-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Checking for drops…</span>
        </div>
      ) : drops.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-8 gap-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Inbox className="h-8 w-8 opacity-40" />
          <p className="text-sm">No pending drops</p>
        </div>
      ) : (
        <div
          className="divide-y"
          style={{ borderColor: "var(--color-border-card)" }}
        >
          {drops.map((drop) => (
            <div
              key={drop.path}
              className="flex items-center justify-between py-4 first:pt-0 gap-3"
            >
              {/* Drop icon */}
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(138,96,53,0.10)" }}
              >
                <Inbox
                  className="h-4 w-4"
                  style={{ color: "var(--color-text-secondary)" }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {drop.denName}
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Visitor {drop.visitorId.slice(0, 8)}… ·{" "}
                  {relativeTime(drop.droppedAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleGoToDen(drop.denId)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-75"
                  style={{
                    background: "rgba(138,96,53,0.10)",
                    color: "var(--color-text-secondary)",
                  }}
                  title="Go to den to import this drop"
                >
                  Import
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDelete(drop.path)}
                  disabled={deletingPath === drop.path}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-opacity hover:opacity-75 disabled:opacity-50"
                  style={{
                    borderColor: "rgba(192,57,43,0.25)",
                    color: "#c0392b",
                    background: "rgba(192,57,43,0.06)",
                  }}
                  title="Discard this drop"
                >
                  {deletingPath === drop.path ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── How it works card ─────────────────────────────────────────────────────────

function HowItWorksCard() {
  return (
    <SectionCard
      title="How Letterbox works"
      subtitle="Async drop delivery for offline hosts"
    >
      <div className="space-y-3">
        {[
          {
            step: "1",
            text: "A visitor with a Letterbox key leaves an encrypted drop when you are offline.",
          },
          {
            step: "2",
            text: "The drop is stored securely in Supabase Storage. Your server cannot read it.",
          },
          {
            step: "3",
            text: 'Open the den to automatically collect and decrypt all pending drops. Click "Import" above to navigate there.',
          },
        ].map(({ step, text }) => (
          <div key={step} className="flex gap-3">
            <span
              className="h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: "rgba(138,96,53,0.12)",
                color: "var(--color-text-secondary)",
              }}
            >
              {step}
            </span>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {text}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
