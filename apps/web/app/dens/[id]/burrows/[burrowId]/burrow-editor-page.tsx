"use client";

import "@meerkat/editor/editor.css";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Archive,
  Trash2,
} from "lucide-react";
import {
  useBurrow,
  useBurrowDoc,
  setBurrowMetadata,
  addBurrowViewer,
} from "@meerkat/burrows";
import type { BurrowMetadata } from "@meerkat/burrows";
import {
  BurrowEditor,
  NodeViewWrapper,
  type NodeViewProps,
  type VoiceBlockAttrs,
} from "@meerkat/editor";
import { ConfirmModal } from "@meerkat/ui";
import { TopNav } from "@/components/top-nav";
import { startNavigationProgress } from "@/components/navigation-progress";
import { useVoiceRecorder } from "@meerkat/voice";
import { decryptBlob } from "@meerkat/crypto";
import type { EncryptedBlob } from "@meerkat/crypto";
import { useVoiceMemoUpload } from "@/hooks/use-voice-memo-upload";
import { createClient } from "@/lib/supabase/client";
import { loadVaultKey } from "@/lib/vault-credentials";

// ─── Voice block node view ────────────────────────────────────────────────────

/**
 * Creates a custom Tiptap node view for voice blocks.
 * Closed over denId + userId so the node can upload to the right folder.
 */
function createVoiceBlockRenderer(denId: string, userId: string) {
  return function VoiceBlockNodeView({
    node,
    updateAttributes,
    selected,
  }: NodeViewProps) {
    const attrs = node.attrs as VoiceBlockAttrs;
    const { uploadVoiceMemo } = useVoiceMemoUpload(denId, userId);
    const recorder = useVoiceRecorder();
    const [playUrl, setPlayUrl] = useState<string | null>(null);
    const [playError, setPlayError] = useState<string | null>(null);

    // Resolve playback URL when a stored blobRef is present
    useEffect(() => {
      if (!attrs.audioUrl) return;
      let cancelled = false;
      let objectUrl: string | null = null;

      async function resolve() {
        const supabase = createClient();
        const { data, error } = await supabase.storage
          .from("voice-notes")
          .createSignedUrl(attrs.audioUrl!, 3600);

        if (cancelled) return;
        if (error || !data) {
          setPlayError("Could not load audio.");
          return;
        }

        if (attrs.audioUrl!.endsWith(".enc")) {
          const vaultKey = await loadVaultKey();
          if (!vaultKey) {
            setPlayError("Vault key unavailable for decryption.");
            return;
          }
          const resp = await fetch(data.signedUrl);
          const json = (await resp.json()) as EncryptedBlob;
          const bytes = await decryptBlob(json, vaultKey);
          // .slice() produces a Uint8Array backed by a plain ArrayBuffer,
          // which is required by the Blob constructor's strict typing.
          objectUrl = URL.createObjectURL(
            new Blob([bytes.slice()], { type: "audio/webm" }),
          );
        } else {
          objectUrl = data.signedUrl;
        }

        if (!cancelled && objectUrl) setPlayUrl(objectUrl);
      }

      resolve().catch((err: unknown) => {
        if (!cancelled)
          setPlayError(
            err instanceof Error ? err.message : "Failed to load audio.",
          );
      });

      return () => {
        cancelled = true;
        if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
      };
    }, [attrs.audioUrl]);

    const handleSave = useCallback(async () => {
      if (!recorder.audioBlob) return;
      const { voiceUrl, analysis } = await uploadVoiceMemo(
        recorder.audioBlob,
        recorder.seconds,
      );
      updateAttributes({
        audioUrl: voiceUrl,
        duration: recorder.seconds,
        mood: analysis?.mood ?? null,
        moodScore: analysis?.valence ?? null,
        transcript: analysis?.transcript ?? null,
      });
    }, [
      recorder.audioBlob,
      recorder.seconds,
      uploadVoiceMemo,
      updateAttributes,
    ]);

    const cls = [
      "voice-block not-prose my-2 rounded-xl border border-border p-3",
      selected ? "ring-2 ring-offset-1 ring-primary" : "",
    ].join(" ");

    // ── Playback mode ────────────────────────────────────────────────────────
    if (attrs.audioUrl) {
      return (
        <NodeViewWrapper className={cls} contentEditable={false}>
          <div className="flex items-start gap-3">
            <span className="text-2xl select-none mt-0.5">🎙</span>
            <div className="flex-1 min-w-0">
              {playError ? (
                <span className="text-sm text-destructive">{playError}</span>
              ) : playUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio
                  controls
                  src={playUrl}
                  className="w-full h-9"
                  preload="metadata"
                />
              ) : (
                <span className="text-sm text-muted-foreground animate-pulse">
                  Loading audio…
                </span>
              )}
              {attrs.duration > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {Math.round(attrs.duration)}s
                </span>
              )}
              {attrs.transcript && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {attrs.transcript}
                </p>
              )}
            </div>
            {attrs.mood && (
              <span className="flex-none text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {attrs.mood}
              </span>
            )}
          </div>
        </NodeViewWrapper>
      );
    }

    // ── Recording mode ───────────────────────────────────────────────────────
    return (
      <NodeViewWrapper className={cls} contentEditable={false}>
        <div className="flex items-center gap-3">
          <span className="text-2xl select-none">🎙</span>
          <div className="flex-1 min-w-0">
            {recorder.phase === "idle" && (
              <button
                onClick={() => void recorder.start()}
                className="text-sm px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Record voice note
              </button>
            )}
            {recorder.phase === "requesting" && (
              <span className="text-sm text-muted-foreground animate-pulse">
                Requesting microphone…
              </span>
            )}
            {recorder.phase === "recording" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive animate-pulse">
                  ● {recorder.seconds}s
                </span>
                <button
                  onClick={recorder.stop}
                  className="text-sm px-3 py-1 rounded-lg bg-muted hover:bg-accent transition-colors"
                >
                  Stop
                </button>
              </div>
            )}
            {recorder.phase === "stopping" && (
              <span className="text-sm text-muted-foreground animate-pulse">
                Processing…
              </span>
            )}
            {recorder.phase === "preview" && (
              <div className="flex flex-col gap-2">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  controls
                  src={recorder.audioUrl ?? ""}
                  className="w-full h-9"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSave()}
                    className="text-sm px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                  <button
                    onClick={recorder.discard}
                    className="text-sm px-3 py-1 rounded-lg bg-muted hover:bg-accent transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
            {recorder.phase === "saving" && (
              <span className="text-sm text-muted-foreground animate-pulse">
                Saving & analysing…
              </span>
            )}
            {recorder.phase === "error" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">
                  {recorder.errorMessage}
                </span>
                <button
                  onClick={() => void recorder.start()}
                  className="text-sm px-2 py-0.5 rounded-lg bg-muted hover:bg-accent transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    );
  };
}

// ─── Burrow stats badge ───────────────────────────────────────────────────────

function BurrowStats({
  wordCount,
  collaboratorCount,
  viewCount,
  voiceNoteCount,
  imageCount,
}: {
  wordCount: number | undefined;
  collaboratorCount: number;
  viewCount: number;
  voiceNoteCount: number;
  imageCount: number;
}) {
  const parts: string[] = [];
  if (wordCount !== undefined) {
    parts.push(`${wordCount} ${wordCount === 1 ? "word" : "words"}`);
  }
  if (voiceNoteCount > 0) {
    parts.push(`🎙 ${voiceNoteCount}`);
  }
  if (imageCount > 0) {
    parts.push(`🖼 ${imageCount}`);
  }
  if (collaboratorCount > 0) {
    parts.push(
      `${collaboratorCount} ${collaboratorCount === 1 ? "editor" : "editors"}`,
    );
  }
  if (viewCount > 0) {
    parts.push(`${viewCount} ${viewCount === 1 ? "view" : "views"}`);
  }

  if (parts.length === 0) return null;

  return (
    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
      {parts.join(" · ")}
    </span>
  );
}

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
  // Prevent adding the current user to collaborators more than once per session
  const collaboratorTrackedRef = useRef(false);
  const {
    burrow,
    metadata,
    isLoading: burrowLoading,
    actions,
  } = useBurrow(denId, burrowId);
  const { doc, isLoading: docLoading } = useBurrowDoc(burrow?.yjsDocId);

  // Stable voice block renderer, recreated only if den/user changes
  const VoiceNodeView = useMemo(
    () => createVoiceBlockRenderer(denId, userId),
    [denId, userId],
  );

  // Mark this burrow as active and record the view when the page mounts
  useEffect(() => {
    import("@meerkat/burrows").then(({ setCurrentBurrow }) => {
      setCurrentBurrow(denId, burrowId);
      return () => setCurrentBurrow(denId, null);
    });
    // Record this user as a visitor viewer — owners are excluded
    if (!isOwner) void addBurrowViewer(denId, burrowId, userId);
  }, [denId, burrowId, userId, isOwner]);

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
    voiceNoteCount: number;
    imageCount: number;
  }) {
    const meta: BurrowMetadata = { ...stats, lastEditedBy: userId };
    await setBurrowMetadata(denId, burrowId, meta);

    // Auto-add the current user to collaborators on their first edit this session
    if (!collaboratorTrackedRef.current) {
      collaboratorTrackedRef.current = true;
      if (burrow && !burrow.collaborators.includes(userId)) {
        void actions.updateBurrow({
          collaborators: [...burrow.collaborators, userId],
        });
      }
    }
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
    <div className="h-screen overflow-hidden flex flex-col page-bg">
      <TopNav user={user} />

      {/*
        The TopNav is fixed (top-0, ~64px tall). This spacer pushes content
        below it. The remaining space is a flex column: sticky header + scroll zone.
      */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ flex: "1 1 0", marginTop: "72px" }}
      >
        <div className="max-w-4xl w-full mx-auto px-4 flex flex-col h-full overflow-hidden">
          {/* Breadcrumb / actions row — always visible */}
          <div
            className="flex-shrink-0 flex items-center justify-between py-3 border-b"
            style={{ borderColor: "var(--color-border-card)" }}
          >
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
              <BurrowStats
                wordCount={metadata?.wordCount}
                collaboratorCount={burrow?.collaborators.length ?? 0}
                viewCount={burrow?.viewedBy?.length ?? 0}
                voiceNoteCount={metadata?.voiceNoteCount ?? 0}
                imageCount={metadata?.imageCount ?? 0}
              />
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

          {/* Scrollable editor area */}
          <div className="flex-1 overflow-y-auto py-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <BurrowEditor
              doc={doc}
              user={{ name: user.name, color: userColor(userId) }}
              title={burrow.title}
              icon={burrow.icon}
              onTitleChange={(title) => void actions.updateBurrow({ title })}
              onIconChange={(icon) => void actions.updateBurrow({ icon })}
              onUpdate={(stats) => void handleUpdate(stats)}
              renderVoiceBlock={VoiceNodeView}
              readOnly={!isOwner}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
