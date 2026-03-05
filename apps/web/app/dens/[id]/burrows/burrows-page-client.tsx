"use client";

import { useState } from "react";
import Link from "next/link";
import { useBurrows } from "@meerkat/burrows";
import type { BurrowData } from "@meerkat/burrows";

interface BurrowsPageClientProps {
  denId: string;
  denName: string;
  userId: string;
  isOwner: boolean;
}

export function BurrowsPageClient({
  denId,
  denName,
  userId,
  isOwner,
}: BurrowsPageClientProps) {
  const { burrows, isLoading, error, actions } = useBurrows(denId);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await actions.createBurrow({
        title: "Untitled",
        createdBy: userId,
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/dens/${denId}`}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ← {denName}
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-base font-semibold text-foreground">Burrows</h1>
        </div>

        {isOwner && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {creating ? "Digging…" : "+ Dig new burrow"}
          </button>
        )}
      </header>

      {/* ── Content ── */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        {isLoading ? (
          <BurrowsSkeleton />
        ) : error ? (
          <p className="text-destructive text-sm">
            Failed to load burrows: {error.message}
          </p>
        ) : burrows.length === 0 ? (
          <EmptyState isOwner={isOwner} onCreate={handleCreate} />
        ) : (
          <div className="flex flex-col gap-2">
            {burrows.map((b) => (
              <BurrowCard
                key={b.id}
                burrow={b}
                denId={denId}
                onArchive={
                  isOwner ? () => actions.archiveBurrow(b.id) : undefined
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── BurrowCard ───────────────────────────────────────────────────────────────

function BurrowCard({
  burrow,
  denId,
  onArchive,
}: {
  burrow: BurrowData;
  denId: string;
  onArchive?: () => void;
}) {
  const lastUpdated = new Date(burrow.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-border hover:border-foreground/20 hover:bg-accent/30 transition-all">
      <Link
        href={`/dens/${denId}/burrows/${burrow.id}`}
        className="flex items-center gap-4 flex-1 min-w-0"
      >
        <span className="text-2xl select-none flex-none">
          {burrow.icon ?? "📄"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {burrow.title || "Untitled"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Updated {lastUpdated}
          </p>
        </div>
      </Link>

      {onArchive && (
        <button
          onClick={(e) => {
            e.preventDefault();
            if (confirm(`Archive "${burrow.title || "Untitled"}"?`)) {
              void onArchive();
            }
          }}
          className="flex-none opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive text-xs px-2 py-1 rounded"
        >
          Archive
        </button>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  isOwner,
  onCreate,
}: {
  isOwner: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="text-6xl select-none">🦡</div>
      <div>
        <p className="text-lg font-medium text-foreground">No burrows yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          {isOwner
            ? "Dig your first burrow to start writing."
            : "No pages have been shared with you yet."}
        </p>
      </div>
      {isOwner && (
        <button
          onClick={onCreate}
          className="mt-2 px-6 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Dig new burrow
        </button>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BurrowsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl border border-border bg-muted animate-pulse"
        />
      ))}
    </div>
  );
}
