"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useBurrow, useBurrowDoc, setBurrowMetadata } from "@meerkat/burrows";
import type { BurrowMetadata } from "@meerkat/burrows";
import { BurrowEditor } from "@meerkat/editor";

// Pick a deterministic colour for the user's collaboration cursor
function userColor(userId: string): string {
  const palette = [
    "#7c3aed", "#2563eb", "#059669", "#d97706",
    "#dc2626", "#db2777", "#0891b2", "#65a30d",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
  }
  return palette[Math.abs(hash) % palette.length] as string;
}

interface BurrowEditorPageProps {
  denId: string;
  denName: string;
  burrowId: string;
  userId: string;
  userName: string;
  isOwner: boolean;
}

export function BurrowEditorPage({
  denId,
  denName,
  burrowId,
  userId,
  userName,
  isOwner,
}: BurrowEditorPageProps) {
  const { burrow, metadata, isLoading: burrowLoading, actions } = useBurrow(denId, burrowId);
  const { doc, isLoading: docLoading } = useBurrowDoc(burrow?.yjsDocId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark this burrow as active when the page mounts
  useEffect(() => {
    import("@meerkat/burrows").then(({ setCurrentBurrow }) => {
      setCurrentBurrow(denId, burrowId);
      return () => setCurrentBurrow(denId, null);
    });
  }, [denId, burrowId]);

  const isLoading = burrowLoading || docLoading;

  async function handleUpdate(stats: {
    wordCount: number;
    hasVoiceNotes: boolean;
    hasImages: boolean;
  }) {
    const meta: BurrowMetadata = {
      ...stats,
      lastEditedBy: userId,
    };
    await setBurrowMetadata(denId, burrowId, meta);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header denId={denId} denName={denName} title="Loading…" />
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
          <div className="h-12 bg-muted rounded-lg animate-pulse w-2/3" />
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (!burrow || !doc) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Burrow not found.</p>
        <Link href={`/dens/${denId}/burrows`} className="text-sm underline">
          Back to burrows
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        denId={denId}
        denName={denName}
        title={burrow.title || "Untitled"}
        wordCount={metadata?.wordCount}
        isOwner={isOwner}
        onArchive={isOwner ? () => actions.archiveBurrow() : undefined}
      />

      <BurrowEditor
        doc={doc}
        user={{ name: userName, color: userColor(userId) }}
        title={burrow.title}
        icon={burrow.icon}
        onTitleChange={(title) => void actions.updateBurrow({ title })}
        onIconChange={(icon) => void actions.updateBurrow({ icon })}
        onUpdate={(stats) => void handleUpdate(stats)}
        readOnly={!isOwner}
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  denId,
  denName,
  title,
  wordCount,
  isOwner,
  onArchive,
}: {
  denId: string;
  denName: string;
  title: string;
  wordCount?: number;
  isOwner?: boolean;
  onArchive?: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <Link
          href={`/dens/${denId}`}
          className="text-muted-foreground hover:text-foreground transition-colors flex-none"
        >
          {denName}
        </Link>
        <span className="text-muted-foreground flex-none">/</span>
        <Link
          href={`/dens/${denId}/burrows`}
          className="text-muted-foreground hover:text-foreground transition-colors flex-none"
        >
          Burrows
        </Link>
        <span className="text-muted-foreground flex-none">/</span>
        <span className="text-foreground font-medium truncate">{title}</span>
      </div>

      <div className="flex items-center gap-3 flex-none">
        {wordCount !== undefined && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        )}
        {isOwner && onArchive && (
          <button
            onClick={() => {
              if (confirm("Archive this burrow?")) onArchive();
            }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Archive
          </button>
        )}
      </div>
    </header>
  );
}
