"use client";

import "@meerkat/editor/editor.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Archive,
  Trash2,
} from "lucide-react";
import { useBurrow, useBurrowDoc, setBurrowMetadata } from "@meerkat/burrows";
import type { BurrowMetadata } from "@meerkat/burrows";
import { BurrowEditor } from "@meerkat/editor";
import { ConfirmModal } from "@meerkat/ui";
import { TopNav } from "@/components/top-nav";
import { startNavigationProgress } from "@/components/navigation-progress";

// Pick a deterministic colour for the user's collaboration cursor
function userColor(userId: string): string {
  const palette = [
    "#7c3aed",
    "#2563eb",
    "#059669",
    "#d97706",
    "#dc2626",
    "#db2777",
    "#0891b2",
    "#65a30d",
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
  isOwner: boolean;
  user: { name: string; preferredName: string | null; email: string };
}

export function BurrowEditorPage({
  denId,
  denName,
  burrowId,
  userId,
  isOwner,
  user,
}: BurrowEditorPageProps) {
  const router = useRouter();
  const [navigatingBack, setNavigatingBack] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "archive" | "delete" | null
  >(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    burrow,
    metadata,
    isLoading: burrowLoading,
    actions,
  } = useBurrow(denId, burrowId);
  const { doc, isLoading: docLoading } = useBurrowDoc(burrow?.yjsDocId);

  // Mark this burrow as active when the page mounts
  useEffect(() => {
    import("@meerkat/burrows").then(({ setCurrentBurrow }) => {
      setCurrentBurrow(denId, burrowId);
      return () => setCurrentBurrow(denId, null);
    });
  }, [denId, burrowId]);

  // Close three-dots menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const isLoading = burrowLoading || docLoading;

  async function handleUpdate(stats: {
    wordCount: number;
    hasVoiceNotes: boolean;
    hasImages: boolean;
  }) {
    const meta: BurrowMetadata = { ...stats, lastEditedBy: userId };
    await setBurrowMetadata(denId, burrowId, meta);
  }

  function handleBack() {
    setNavigatingBack(true);
    startNavigationProgress();
    router.push(`/dens/${denId}/burrows`);
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen page-bg">
        <TopNav user={user} />
        <main className="max-w-4xl mx-auto px-4 pt-8 pb-32">
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="link-subtle inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 -ml-3 rounded-xl"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <ArrowLeft className="h-4 w-4" />
              Burrows
            </button>
          </div>
          <div
            className="rounded-2xl px-6 py-10 space-y-4"
            style={{
              background: "var(--color-bg-card)",
              border: "1.5px dashed var(--color-border-card)",
            }}
          >
            <div
              className="h-12 rounded-lg animate-pulse w-2/3"
              style={{ background: "var(--color-border-card)" }}
            />
            <div
              className="h-4 rounded animate-pulse"
              style={{ background: "var(--color-border-card)" }}
            />
            <div
              className="h-4 rounded animate-pulse w-3/4"
              style={{ background: "var(--color-border-card)" }}
            />
            <div
              className="h-4 rounded animate-pulse w-1/2"
              style={{ background: "var(--color-border-card)" }}
            />
          </div>
        </main>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────

  if (!burrow || !doc) {
    return (
      <div className="min-h-screen page-bg">
        <TopNav user={user} />
        <main className="max-w-4xl mx-auto px-4 pt-8 pb-32 flex flex-col items-center justify-center gap-4">
          <p style={{ color: "var(--color-text-muted)" }}>Burrow not found.</p>
          <Link
            href={`/dens/${denId}/burrows`}
            className="text-sm underline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Back to burrows
          </Link>
        </main>
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen page-bg">
      <TopNav user={user} />

      <main className="max-w-4xl mx-auto px-4 pt-8 pb-32">
        {/* Breadcrumb / actions row */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBack}
            disabled={navigatingBack}
            className="link-subtle inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 -ml-3 rounded-xl disabled:opacity-60"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {navigatingBack ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowLeft className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{denName} /&nbsp;</span>
            Burrows
          </button>

          <div className="flex items-center gap-3">
            {metadata?.wordCount !== undefined && (
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {metadata.wordCount}{" "}
                {metadata.wordCount === 1 ? "word" : "words"}
              </span>
            )}
            {isOwner && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-accent/40"
                  style={{ color: "var(--color-text-muted)" }}
                  aria-label="Burrow options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-44 rounded-xl py-1 z-50"
                    style={{
                      background: "var(--color-bg-dropdown)",
                      border: "1.5px solid var(--color-border-card)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmAction("archive");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent/40 text-left"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      <Archive className="h-3.5 w-3.5 flex-none" />
                      Archive
                    </button>
                    <div
                      className="my-1 mx-2 h-px"
                      style={{ background: "var(--color-border-card)" }}
                    />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmAction("delete");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent/40 text-left"
                      style={{ color: "#e05c4a" }}
                    >
                      <Trash2 className="h-3.5 w-3.5 flex-none" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {confirmAction && (
          <ConfirmModal
            title={
              confirmAction === "delete" ? "Delete burrow" : "Archive burrow"
            }
            description={
              confirmAction === "delete"
                ? `"${burrow.title || "Untitled"}" will be permanently deleted and cannot be recovered.`
                : `"${burrow.title || "Untitled"}" will be archived and hidden from the list.`
            }
            confirmLabel={confirmAction === "delete" ? "Delete" : "Archive"}
            onClose={() => setConfirmAction(null)}
            onConfirm={async () => {
              if (confirmAction === "delete") {
                await actions.deleteBurrow();
                router.push(`/dens/${denId}/burrows`);
              } else {
                await actions.archiveBurrow();
                router.push(`/dens/${denId}/burrows`);
              }
              setConfirmAction(null);
            }}
          />
        )}

        <BurrowEditor
          doc={doc}
          user={{ name: user.name, color: userColor(userId) }}
          title={burrow.title}
          icon={burrow.icon}
          onTitleChange={(title) => void actions.updateBurrow({ title })}
          onIconChange={(icon) => void actions.updateBurrow({ icon })}
          onUpdate={(stats) => void handleUpdate(stats)}
          readOnly={!isOwner}
        />
      </main>
    </div>
  );
}
