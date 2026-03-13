"use client";

import "@meerkat/editor/editor.css";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { VoicePlayerCard } from "@/components/voice-player-card";

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
        arousal: analysis?.arousal ?? null,
        confidence: analysis?.confidence ?? null,
        tone: analysis?.tone ?? null,
        transcript: analysis?.transcript ?? null,
      });
    }, [
      recorder.audioBlob,
      recorder.seconds,
      uploadVoiceMemo,
      updateAttributes,
    ]);

    const outerCls = "not-prose my-2";
    const selectedScale: React.CSSProperties = {
      transform: selected ? "scale(1.04)" : "scale(1)",
      transition: "transform 150ms ease",
      transformOrigin: "top left",
    };

    // Shared card style — matches VoicePlayerCard aesthetic.
    const cardStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.75rem",
      padding: "0.75rem 1rem",
      minWidth: 200,
      maxWidth: 260,
      background: "var(--color-bg-card)",
      border: "1px solid var(--color-border-card)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      borderRadius: "22px 22px 22px 4px",
    };

    // Mood constants (kept local to this renderer).
    const MOOD_COLOR: Record<string, string> = {
      happy: "#FBBF24",
      sad: "#60A5FA",
      angry: "#F87171",
      fearful: "#A78BFA",
      disgusted: "#34D399",
      surprised: "#FB923C",
      neutral: "#94A3B8",
    };
    const MOOD_EMOJI: Record<string, string> = {
      happy: "😊",
      sad: "😔",
      angry: "😤",
      fearful: "😨",
      disgusted: "😒",
      surprised: "😲",
      neutral: "😐",
    };
    const MOOD_LABEL: Record<string, string> = {
      happy: "Happy",
      sad: "Sad",
      angry: "Angry",
      fearful: "Anxious",
      disgusted: "Displeased",
      surprised: "Surprised",
      neutral: "Neutral",
    };

    // ── Playback mode ────────────────────────────────────────────────────────
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [moodExpanded, setMoodExpanded] = useState(false);

    if (attrs.audioUrl) {
      const moodKey = typeof attrs.mood === "string" ? attrs.mood : null;
      const moodColor = moodKey ? (MOOD_COLOR[moodKey] ?? "#94A3B8") : null;
      const moodEmoji = moodKey ? (MOOD_EMOJI[moodKey] ?? null) : null;
      const moodLabel = moodKey ? (MOOD_LABEL[moodKey] ?? moodKey) : null;
      // moodScore is valence in -1..1, convert to 0..100%
      const valencePct =
        typeof attrs.moodScore === "number"
          ? Math.round(((attrs.moodScore + 1) / 2) * 100)
          : null;
      const arousalPct =
        typeof attrs.arousal === "number"
          ? Math.round(attrs.arousal * 100)
          : null;
      const confidencePct =
        typeof attrs.confidence === "number"
          ? Math.round(attrs.confidence * 100)
          : null;
      const toneLabel =
        typeof attrs.tone === "string" && attrs.tone ? attrs.tone : null;
      const displayLabel =
        moodLabel && toneLabel
          ? `${moodLabel} · ${toneLabel}`
          : (toneLabel ?? moodLabel ?? "");

      return (
        <NodeViewWrapper className={outerCls} contentEditable={false}>
          <div className="inline-flex gap-2 items-end">
            <div className="flex flex-col gap-1.5" style={selectedScale}>
              {playError ? (
                <div
                  style={{ ...cardStyle, color: "#F87171", fontSize: "0.8rem" }}
                >
                  ⚠ {playError}
                </div>
              ) : (
                <VoicePlayerCard
                  src={playUrl}
                  isLoading={!playUrl && !playError}
                  duration={attrs.duration ?? 0}
                />
              )}
            </div>

            {/* Mood emoji toggle button */}
            {moodEmoji && moodColor && (
              <button
                onClick={() => setMoodExpanded((v) => !v)}
                className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-sm self-center transition-all hover:scale-110 active:scale-95"
                style={{
                  background: `${moodColor}18`,
                  border: `1px solid ${moodColor}40`,
                }}
                aria-label={moodExpanded ? "Collapse mood" : "Expand mood"}
              >
                {moodEmoji}
              </button>
            )}

            {/* Mood detail panel — right of player, expands outward */}
            {moodEmoji && moodColor && moodLabel && (
              <AnimatePresence>
                {moodExpanded && (
                  <motion.div
                    key="mood-panel"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 140, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      className="flex flex-col gap-2 shrink-0"
                      style={{ width: 140 }}
                    >
                      <div
                        className="text-[10px] font-semibold leading-none px-0.5 truncate w-full"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {displayLabel}
                        {confidencePct !== null ? ` · ${confidencePct}%` : ""}
                      </div>
                      {valencePct !== null && (
                        <div className="flex items-center gap-1">
                          <span
                            className="text-[9px] w-8 shrink-0 leading-none"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Mood
                          </span>
                          <div
                            className="flex-1 h-1 rounded-full overflow-hidden"
                            style={{
                              background: "var(--color-btn-secondary-bg)",
                            }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${valencePct}%`,
                                background: moodColor,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {arousalPct !== null && (
                        <div className="flex items-center gap-1">
                          <span
                            className="text-[9px] w-8 shrink-0 leading-none"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            Energy
                          </span>
                          <div
                            className="flex-1 h-1 rounded-full overflow-hidden"
                            style={{
                              background: "var(--color-btn-secondary-bg)",
                            }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${arousalPct}%`,
                                background: moodColor,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {typeof attrs.transcript === "string" &&
                        attrs.transcript && (
                          <p
                            className="text-[10px] italic leading-relaxed line-clamp-3"
                            style={{
                              color: "var(--color-text-primary)",
                              opacity: 0.75,
                            }}
                          >
                            &ldquo;{attrs.transcript}&rdquo;
                          </p>
                        )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </NodeViewWrapper>
      );
    }

    // ── Recording mode ───────────────────────────────────────────────────────

    // Preview: use VoicePlayerCard + Save/Discard below.
    if (recorder.phase === "preview") {
      return (
        <NodeViewWrapper className={outerCls} contentEditable={false}>
          <div className="inline-flex flex-col gap-2" style={selectedScale}>
            <VoicePlayerCard
              src={recorder.audioUrl}
              duration={recorder.seconds}
            />
            <div className="flex gap-2 px-1">
              <button
                onClick={() => void handleSave()}
                className="text-xs px-3 py-1 rounded-full font-medium transition-opacity hover:opacity-90"
                style={{ background: "#d4673a", color: "white" }}
              >
                Save
              </button>
              <button
                onClick={recorder.discard}
                className="text-xs px-3 py-1 rounded-full font-medium transition-opacity hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "var(--color-text-muted)",
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </NodeViewWrapper>
      );
    }

    // All other recording phases share a compact card layout.
    return (
      <NodeViewWrapper className={outerCls} contentEditable={false}>
        <div style={{ ...cardStyle, ...selectedScale }}>
          {/* Mic icon button */}
          <button
            onClick={
              recorder.phase === "idle"
                ? () => void recorder.start()
                : recorder.phase === "recording"
                  ? recorder.stop
                  : recorder.phase === "error"
                    ? () => void recorder.start()
                    : undefined
            }
            disabled={
              recorder.phase === "requesting" ||
              recorder.phase === "stopping" ||
              recorder.phase === "saving"
            }
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 bg-[#d4673a] shadow-lg hover:brightness-110 disabled:opacity-60"
            aria-label="Record"
          >
            {recorder.phase === "requesting" ||
            recorder.phase === "stopping" ||
            recorder.phase === "saving" ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : recorder.phase === "recording" ? (
              <span className="h-3.5 w-3.5 rounded-sm bg-white" />
            ) : (
              <span className="text-base select-none">🎙</span>
            )}
          </button>

          {/* Status text */}
          <div className="flex-1 min-w-0">
            {recorder.phase === "idle" && (
              <span
                className="text-sm font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Tap to record
              </span>
            )}
            {recorder.phase === "requesting" && (
              <span
                className="text-sm animate-pulse"
                style={{ color: "var(--color-text-muted)" }}
              >
                Requesting mic…
              </span>
            )}
            {recorder.phase === "recording" && (
              <span
                className="text-sm font-mono animate-pulse"
                style={{ color: "#d4673a" }}
              >
                ● {recorder.seconds}s — tap to stop
              </span>
            )}
            {recorder.phase === "stopping" && (
              <span
                className="text-sm animate-pulse"
                style={{ color: "var(--color-text-muted)" }}
              >
                Processing…
              </span>
            )}
            {recorder.phase === "saving" && (
              <span
                className="text-sm animate-pulse"
                style={{ color: "var(--color-text-muted)" }}
              >
                Saving & analysing…
              </span>
            )}
            {recorder.phase === "error" && (
              <span className="text-xs" style={{ color: "#F87171" }}>
                {recorder.errorMessage ?? "Error"} — tap to retry
              </span>
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
