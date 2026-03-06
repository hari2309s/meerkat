"use client";

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Pencil,
  Archive,
  Trash2,
  Plus,
  Mic,
  ImageIcon,
  Users,
} from "lucide-react";
import { useBurrows } from "@meerkat/burrows";
import type { BurrowData, BurrowMetadata } from "@meerkat/burrows";
import { ConfirmModal } from "@meerkat/ui";
import { TopNav } from "@/components/top-nav";
import { DenNavTabs } from "@/components/den/den-nav-tabs";
import { startNavigationProgress } from "@/components/navigation-progress";

interface BurrowsPageClientProps {
  denId: string;
  denName: string;
  userId: string;
  isOwner: boolean;
  user: { name: string; preferredName: string | null; email: string };
}

export function BurrowsPageClient({
  denId,
  denName,
  userId,
  isOwner,
  user,
}: BurrowsPageClientProps) {
  const router = useRouter();
  const { burrows, metadataMap, isLoading, error, actions } = useBurrows(denId);
  const [navigatingBack, setNavigatingBack] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  // Snapshot of IDs that existed before creation started — used to filter out
  // the new burrow that Yjs adds synchronously before navigation completes.
  const [preCreateIds, setPreCreateIds] = useState<ReadonlySet<string> | null>(
    null,
  );

  function handleBack() {
    setNavigatingBack(true);
    startNavigationProgress();
    router.push(`/dens/${denId}`);
  }

  async function handleCreate(title: string) {
    // Snapshot current IDs before the await so this batches with the Yjs
    // observer's setBurrows call, keeping existing burrows visible while hiding
    // the newly added one until navigation completes.
    setPreCreateIds(new Set(burrows.map((b) => b.id)));
    const burrow = await actions.createBurrow({
      title: title.trim() || "Untitled",
      createdBy: userId,
    });
    setShowNewForm(false);
    startNavigationProgress();
    router.push(`/dens/${denId}/burrows/${burrow.id}`);
  }

  return (
    <div className="min-h-screen page-bg">
      <TopNav user={user} />

      <main className="max-w-4xl mx-auto px-4 pt-8 pb-32">
        {/* ── Back + actions row ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between mb-8"
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
            {denName}
          </button>

          {isOwner && (
            <button
              onClick={() => setShowNewForm(true)}
              className="btn-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              <Plus className="h-4 w-4" />
              New burrow
            </button>
          )}
        </motion.div>

        {/* ── Section heading + tabs ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
          className="mb-6"
        >
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Burrows
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            Pages and notes inside {denName}
          </p>
          {!isLoading && (
            <p
              className="mt-1.5 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {burrows.length === 0
                ? "No burrows yet"
                : `${burrows.length} ${burrows.length === 1 ? "burrow" : "burrows"}`}
            </p>
          )}
        </motion.div>

        <DenNavTabs denId={denId} activeTab="burrows" />

        {/* ── Content ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
          className="flex flex-col gap-3"
        >
          {/* Inline new-burrow form */}
          {showNewForm && (
            <NewBurrowForm
              onConfirm={handleCreate}
              onCancel={() => setShowNewForm(false)}
            />
          )}

          {isLoading ? (
            <BurrowsSkeleton />
          ) : error ? (
            <p className="text-destructive text-sm">
              Failed to load burrows: {error.message}
            </p>
          ) : burrows.length === 0 && !showNewForm ? (
            <EmptyState
              isOwner={isOwner}
              onCreate={() => setShowNewForm(true)}
            />
          ) : (
            burrows
              .filter((b) => !preCreateIds || preCreateIds.has(b.id))
              .map((b) => (
                <BurrowCard
                  key={b.id}
                  burrow={b}
                  metadata={metadataMap[b.id] ?? null}
                  denId={denId}
                  isOwner={isOwner}
                  currentUserId={userId}
                  onRename={(title) => actions.updateBurrow(b.id, { title })}
                  onArchive={() => actions.archiveBurrow(b.id)}
                  onDelete={() => actions.deleteBurrow(b.id)}
                />
              ))
          )}
        </motion.div>
      </main>
    </div>
  );
}

// ─── NewBurrowForm ─────────────────────────────────────────────────────────────

function NewBurrowForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit() {
    if (saving) return;
    setSaving(true);
    try {
      await onConfirm(title);
    } catch {
      setSaving(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void handleSubmit();
    if (e.key === "Escape") onCancel();
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border-2"
      style={{
        borderColor: "var(--color-text-secondary)",
        background: "var(--color-bg-card, transparent)",
      }}
    >
      <span className="text-2xl select-none flex-none">📄</span>
      <input
        ref={inputRef}
        value={title}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setTitle(e.target.value)
        }
        onKeyDown={handleKeyDown}
        placeholder="Name your burrow…"
        className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
        style={{ color: "var(--color-text-primary)" }}
        disabled={saving}
      />
      <div className="flex items-center gap-2 flex-none">
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          Cancel
        </button>
        <button
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg bg-foreground text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

// ─── BurrowCard ───────────────────────────────────────────────────────────────

function BurrowCard({
  burrow,
  metadata,
  denId,
  isOwner,
  currentUserId,
  onRename,
  onArchive,
  onDelete,
}: {
  burrow: BurrowData;
  metadata: BurrowMetadata | null;
  denId: string;
  isOwner: boolean;
  currentUserId: string;
  onRename: (title: string) => Promise<BurrowData>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(burrow.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "archive" | "delete" | null
  >(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  function formatDate(ms: number) {
    return new Date(ms).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        new Date(ms).getFullYear() !== new Date().getFullYear()
          ? "numeric"
          : undefined,
    });
  }

  function resolveUser(uid: string | null) {
    if (!uid) return null;
    return uid === currentUserId ? "You" : "a collaborator";
  }

  const createdDate = formatDate(burrow.createdAt);
  const updatedDate = formatDate(burrow.updatedAt);
  const createdByLabel = resolveUser(burrow.createdBy);
  const lastEditedBy = resolveUser(metadata?.lastEditedBy ?? null);
  const wordCount = metadata?.wordCount ?? 0;
  const collaboratorCount = burrow.collaborators.length;

  // Close menu on outside click
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

  // Focus rename input when it appears
  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  async function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== burrow.title) {
      await onRename(trimmed);
    } else {
      setRenameValue(burrow.title);
    }
    setRenaming(false);
  }

  function handleRenameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void commitRename();
    if (e.key === "Escape") {
      setRenameValue(burrow.title);
      setRenaming(false);
    }
  }

  function handleArchive() {
    setMenuOpen(false);
    setConfirmAction("archive");
  }

  function handleDelete() {
    setMenuOpen(false);
    setConfirmAction("delete");
  }

  const confirmTitle =
    confirmAction === "delete" ? "Delete burrow" : "Archive burrow";
  const confirmDesc =
    confirmAction === "delete"
      ? `"${burrow.title || "Untitled"}" will be permanently deleted and cannot be recovered.`
      : `"${burrow.title || "Untitled"}" will be archived and hidden from the list.`;
  const confirmLabel = confirmAction === "delete" ? "Delete" : "Archive";

  return (
    <>
      {confirmAction && (
        <ConfirmModal
          title={confirmTitle}
          description={confirmDesc}
          confirmLabel={confirmLabel}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            if (confirmAction === "delete") await onDelete();
            else await onArchive();
            setConfirmAction(null);
          }}
        />
      )}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="group flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all"
        style={{
          background: "var(--color-bg-card)",
          borderColor: "var(--color-border-card)",
          boxShadow: "var(--color-shadow-card)",
        }}
      >
        {/* Icon */}
        <span className="text-2xl select-none flex-none mt-0.5">
          {burrow.icon ?? "📄"}
        </span>

        {/* Title + meta — renaming inline */}
        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setRenameValue(e.target.value)
            }
            onKeyDown={handleRenameKey}
            onBlur={() => void commitRename()}
            className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none border-b"
            style={{
              color: "var(--color-text-primary)",
              borderColor: "var(--color-text-secondary)",
            }}
          />
        ) : (
          <Link
            href={`/dens/${denId}/burrows/${burrow.id}`}
            className="flex-1 min-w-0"
            onClick={() => startNavigationProgress()}
          >
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {burrow.title || "Untitled"}
            </p>

            {/* Primary meta line: created + updated */}
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "var(--color-text-muted)" }}
            >
              Created {createdDate}
              {createdByLabel && ` by ${createdByLabel}`}
              {" · "}
              Updated {updatedDate}
              {lastEditedBy && ` by ${lastEditedBy}`}
            </p>

            {/* Secondary meta line: word count + badges */}
            {(wordCount > 0 ||
              collaboratorCount > 1 ||
              metadata?.hasVoiceNotes ||
              metadata?.hasImages) && (
              <div
                className="flex items-center gap-2 mt-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {wordCount > 0 && (
                  <span className="text-xs">
                    {wordCount.toLocaleString()}{" "}
                    {wordCount === 1 ? "word" : "words"}
                  </span>
                )}
                {collaboratorCount > 1 && (
                  <span className="inline-flex items-center gap-0.5 text-xs">
                    <Users className="h-3 w-3" />
                    {collaboratorCount}
                  </span>
                )}
                {metadata?.hasVoiceNotes && (
                  <span className="inline-flex items-center gap-0.5 text-xs">
                    <Mic className="h-3 w-3" />
                    voice
                  </span>
                )}
                {metadata?.hasImages && (
                  <span className="inline-flex items-center gap-0.5 text-xs">
                    <ImageIcon className="h-3 w-3" />
                    images
                  </span>
                )}
              </div>
            )}
          </Link>
        )}

        {/* Actions menu — owner only */}
        {isOwner && (
          <div ref={menuRef} className="relative flex-none">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="h-7 w-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
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
                <MenuItem
                  icon={Pencil}
                  label="Rename"
                  onClick={() => {
                    setMenuOpen(false);
                    setRenaming(true);
                  }}
                />
                <MenuItem
                  icon={Archive}
                  label="Archive"
                  onClick={handleArchive}
                />
                <div
                  className="my-1 mx-2 h-px"
                  style={{ background: "var(--color-border-card)" }}
                />
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={handleDelete}
                />
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-accent/40 text-left"
      style={{ color: danger ? "#e05c4a" : "var(--color-text-secondary)" }}
    >
      <Icon className="h-3.5 w-3.5 flex-none" />
      {label}
    </button>
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
        <p
          className="text-lg font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          No burrows yet
        </p>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          {isOwner
            ? "Dig your first burrow to start writing."
            : "No pages have been shared with you yet."}
        </p>
      </div>
      {isOwner && (
        <button
          onClick={onCreate}
          className="btn-secondary mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
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
    <>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl border animate-pulse"
          style={{
            background: "var(--color-bg-card)",
            borderColor: "var(--color-border-card)",
          }}
        />
      ))}
    </>
  );
}
