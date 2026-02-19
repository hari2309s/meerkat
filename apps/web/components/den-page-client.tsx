"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "@/components/top-nav";
import { startNavigationProgress } from "@/components/navigation-progress";
import {
  ArrowLeft,
  MoreHorizontal,
  Plus,
  Mic,
  MessageSquare,
  Image,
  Camera,
  FileText,
  X,
  Pencil,
  UserPlus,
  Bell,
  BellOff,
  Trash2,
  LogOut,
  Link,
  Loader2,
  Check,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Den {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
}

interface DenPageClientProps {
  den: Den;
  user: { name: string; email: string };
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameModal({
  den,
  onClose,
  onRenamed,
}: {
  den: Den;
  onClose: () => void;
  onRenamed: (name: string) => void;
}) {
  const [value, setValue] = useState(den.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === den.name) {
      onClose();
      return;
    }
    setSaving(true);
    // Optimistic — actual Supabase call would go here
    await new Promise((r) => setTimeout(r, 500));
    onRenamed(trimmed);
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 14 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative w-full max-w-sm rounded-2xl p-6"
        style={{
          background: "var(--color-bg-card)",
          border: "1.5px solid var(--color-border-card)",
          boxShadow: "var(--color-shadow-card)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="icon-btn absolute right-4 top-4 rounded-lg p-1.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>

        <h2
          className="text-lg font-bold mb-4"
          style={{ color: "var(--color-text-primary)" }}
        >
          Rename den
        </h2>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none mb-4"
          autoFocus
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="btn-secondary flex-1 rounded-xl py-2.5 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="btn-default flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4" />
                Save
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ den, onClose }: { den: Den; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const inviteLink = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/den/${den.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 14 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative w-full max-w-sm rounded-2xl p-6"
        style={{
          background: "var(--color-bg-card)",
          border: "1.5px solid var(--color-border-card)",
          boxShadow: "var(--color-shadow-card)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="icon-btn absolute right-4 top-4 rounded-lg p-1.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>

        <h2
          className="text-lg font-bold mb-1"
          style={{ color: "var(--color-text-primary)" }}
        >
          Invite to {den.name}
        </h2>
        <p
          className="text-sm mb-5"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Share this link to invite someone to this den.
        </p>

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4"
          style={{
            background: "var(--color-input-bg)",
            border: "1.5px solid var(--color-input-border)",
          }}
        >
          <Link
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--color-text-muted)" }}
          />
          <span
            className="text-xs font-mono flex-1 truncate"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {inviteLink}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="btn-default w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Link className="h-4 w-4" />
              Copy invite link
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}

// ─── FAB Action Item ──────────────────────────────────────────────────────────

interface FabAction {
  icon: React.ElementType;
  label: string;
  color?: string;
  onClick: () => void;
}

const FAB_ACTIONS: FabAction[] = [
  {
    icon: Mic,
    label: "Voice message",
    color: "#e07040",
    onClick: () => console.log("voice"),
  },
  {
    icon: MessageSquare,
    label: "Text message",
    color: "var(--color-avatar-bg)",
    onClick: () => console.log("text"),
  },
  {
    icon: Image,
    label: "Photo from library",
    color: "#5b8dd9",
    onClick: () => console.log("photo"),
  },
  {
    icon: Camera,
    label: "Take a photo",
    color: "#4caf7d",
    onClick: () => console.log("camera"),
  },
  {
    icon: FileText,
    label: "Document",
    color: "#b06fc0",
    onClick: () => console.log("document"),
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function DenPageClient({ den: initialDen, user }: DenPageClientProps) {
  const router = useRouter();
  const [den, setDen] = useState(initialDen);
  const [fabOpen, setFabOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [navigatingBack, setNavigatingBack] = useState(false);

  // Modals
  const [showRename, setShowRename] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const handleBack = () => {
    setNavigatingBack(true);
    startNavigationProgress();
    router.push("/");
  };

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
    setFabOpen(false);
  };

  const closeAll = () => {
    setMenuOpen(false);
    setFabOpen(false);
  };

  return (
    <>
      {/* Tap-away overlay for both menus */}
      {(menuOpen || fabOpen) && (
        <div className="fixed inset-0 z-30" onClick={closeAll} />
      )}

      <div className="min-h-screen page-bg" onClick={() => setMenuOpen(false)}>
        {/* Noise texture */}
        <div
          className="fixed inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
            backgroundSize: "150px",
          }}
        />

        <TopNav user={user} />

        <main className="relative z-10 max-w-4xl mx-auto px-4 pt-8 pb-32">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            {/* Back button */}
            <button
              onClick={handleBack}
              disabled={navigatingBack}
              className="link-subtle inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 -ml-3 rounded-lg disabled:opacity-60"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {navigatingBack ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeft className="h-4 w-4" />
              )}
              Back to dens
            </button>

            {/* Three-dots menu */}
            <div className="relative z-40">
              <button
                onClick={openMenu}
                className="icon-btn h-9 w-9 flex items-center justify-center rounded-xl"
                style={{ color: "var(--color-text-secondary)" }}
                aria-label="Den options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -6 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl py-1.5 overflow-hidden"
                    style={{
                      background: "var(--color-bg-dropdown)",
                      border: "1.5px solid var(--color-border-card)",
                      boxShadow: "var(--color-shadow-card-hover)",
                      backdropFilter: "blur(20px) saturate(1.6)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Rename */}
                    <MenuRow
                      icon={Pencil}
                      label="Rename den"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowRename(true);
                      }}
                    />
                    {/* Invite */}
                    <MenuRow
                      icon={UserPlus}
                      label="Invite members"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowInvite(true);
                      }}
                    />
                    {/* Mute toggle */}
                    <MenuRow
                      icon={muted ? Bell : BellOff}
                      label={muted ? "Unmute den" : "Mute den"}
                      onClick={() => {
                        setMuted((v) => !v);
                        setMenuOpen(false);
                      }}
                    />

                    {/* Divider */}
                    <div
                      className="my-1 mx-3 h-px"
                      style={{ background: "var(--color-border-card)" }}
                    />

                    {/* Leave */}
                    <MenuRow
                      icon={LogOut}
                      label="Leave den"
                      danger
                      onClick={() => setMenuOpen(false)}
                    />
                    {/* Delete */}
                    <MenuRow
                      icon={Trash2}
                      label="Delete den"
                      danger
                      onClick={() => setMenuOpen(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Den header */}
          <div className="mb-10">
            <h1
              className="text-3xl font-bold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {den.name}
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              Created{" "}
              {new Date(den.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Empty state */}
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              background: "var(--color-bg-card)",
              border: "1.5px dashed var(--color-border-card)",
            }}
          >
            <p
              className="text-base font-medium mb-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {den.name} is ready
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Send a voice message, text, or media to get things started.
            </p>
          </div>
        </main>

        {/* ── Floating Action Button ── */}
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
          {/* Action items — fan upward */}
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex flex-col-reverse gap-2.5"
              >
                {FAB_ACTIONS.map((action, i) => (
                  <motion.div
                    key={action.label}
                    initial={{ opacity: 0, y: 12, scale: 0.88 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.9 }}
                    transition={{
                      delay: i * 0.04,
                      type: "spring",
                      stiffness: 420,
                      damping: 26,
                    }}
                    className="flex items-center gap-3 self-end"
                  >
                    {/* Label */}
                    <motion.span
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.04 + 0.05 }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-sm pointer-events-none"
                      style={{
                        background: "var(--color-bg-dropdown)",
                        color: "var(--color-text-primary)",
                        border: "1px solid var(--color-border-card)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                      }}
                    >
                      {action.label}
                    </motion.span>

                    {/* Action button */}
                    <button
                      onClick={() => {
                        action.onClick();
                        setFabOpen(false);
                      }}
                      className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
                      style={{
                        background: action.color ?? "var(--color-avatar-bg)",
                        boxShadow: `0 4px 16px ${action.color ?? "var(--color-avatar-bg)"}55`,
                      }}
                      aria-label={action.label}
                    >
                      <action.icon className="h-5 w-5 text-white" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main FAB */}
          <motion.button
            onClick={() => {
              setFabOpen((v) => !v);
              setMenuOpen(false);
            }}
            className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-xl"
            style={{
              background: "var(--color-btn-default-bg)",
              boxShadow: "0 6px 24px var(--color-btn-default-shadow)",
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            aria-label={fabOpen ? "Close actions" : "Add content"}
          >
            <motion.div
              animate={{ rotate: fabOpen ? 45 : 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
              <Plus
                className="h-6 w-6"
                style={{ color: "var(--color-btn-default-text)" }}
              />
            </motion.div>
          </motion.button>
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showRename && (
          <RenameModal
            den={den}
            onClose={() => setShowRename(false)}
            onRenamed={(newName) => setDen({ ...den, name: newName })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInvite && (
          <InviteModal den={den} onClose={() => setShowInvite(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Menu Row ─────────────────────────────────────────────────────────────────

function MenuRow({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${danger ? "dropdown-item-danger" : "dropdown-item"} w-full flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-xl text-sm text-left`}
      style={{
        color: danger ? "#e05c4a" : "var(--color-text-secondary)",
        width: "calc(100% - 12px)",
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
