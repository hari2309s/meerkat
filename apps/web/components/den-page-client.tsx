"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "@/components/top-nav";
import { startNavigationProgress } from "@/components/navigation-progress";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  MoreHorizontal,
  Plus,
  Mic,
  MessageSquare,
  ImageIcon,
  Camera,
  FileText,
  X,
  Pencil,
  UserPlus,
  Bell,
  BellOff,
  Trash2,
  LogOut,
  LinkIcon,
  Loader2,
  Check,
  AlertTriangle,
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
  currentUserId: string;
  user: { name: string; email: string };
}

// ─── Shared Modal Shell ───────────────────────────────────────────────────────

function ModalShell({
  onClose,
  children,
  maxWidth = "max-w-sm",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
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
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(7px)" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 12 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className={`relative w-full ${maxWidth} rounded-2xl p-6`}
        style={{
          background: "var(--color-bg-card)",
          border: "1.5px solid var(--color-border-card)",
          boxShadow: "var(--color-shadow-card-hover)",
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
        {children}
      </motion.div>
    </div>
  );
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
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Den name can't be empty.");
      return;
    }
    if (trimmed === den.name) {
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("dens")
        .update({ name: trimmed })
        .eq("id", den.id);
      if (dbError) throw dbError;
      onRenamed(trimmed);
      toast.success("Den renamed");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename.");
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <h2
        className="text-lg font-bold mb-1"
        style={{ color: "var(--color-text-primary)" }}
      >
        Rename den
      </h2>
      <p
        className="text-sm mb-4"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Give your den a new name.
      </p>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none mb-1"
        autoFocus
      />
      {error ? (
        <p className="text-xs mb-3" style={{ color: "#e07050" }}>
          {error}
        </p>
      ) : (
        <div className="mb-3" />
      )}
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
    </ModalShell>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ den, onClose }: { den: Den; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const inviteLink = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/den/${den.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 800)); // placeholder
    toast.success(`Invite sent to ${trimmed}`);
    setEmail("");
    setSending(false);
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-md">
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
        Send an invite by email or share the link.
      </p>

      <label
        className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
        style={{ color: "var(--color-text-muted)" }}
      >
        Invite by email
      </label>
      <div className="flex gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
          placeholder="friend@example.com"
          className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
        />
        <button
          onClick={handleSendInvite}
          disabled={sending || !email.trim().includes("@")}
          className="btn-default rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex-1 h-px"
          style={{ background: "var(--color-border-card)" }}
        />
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          or
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "var(--color-border-card)" }}
        />
      </div>

      <label
        className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
        style={{ color: "var(--color-text-muted)" }}
      >
        Share invite link
      </label>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3"
        style={{
          background: "var(--color-input-bg)",
          border: "1.5px solid var(--color-input-border)",
        }}
      >
        <LinkIcon
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
        onClick={handleCopyLink}
        className="btn-default w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <LinkIcon className="h-4 w-4" />
            Copy invite link
          </>
        )}
      </button>
    </ModalShell>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div
        className="h-11 w-11 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "rgba(224,92,74,0.12)" }}
      >
        <AlertTriangle className="h-5 w-5" style={{ color: "#e05c4a" }} />
      </div>
      <h2
        className="text-lg font-bold mb-1.5"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h2>
      <p
        className="text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {description}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="btn-secondary flex-1 rounded-xl py-2.5 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:-translate-y-px active:scale-[0.97]"
          style={{
            background: "#c0392b",
            color: "#fff",
            boxShadow: "0 4px 14px rgba(192,57,43,0.35)",
          }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Mute hook (persists to localStorage per den) ────────────────────────────

function useMuted(denId: string) {
  const key = `muted_den_${denId}`;
  const [muted, setMutedState] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(key) === "1" : false,
  );
  const toggle = () => {
    setMutedState((v) => {
      const next = !v;
      localStorage.setItem(key, next ? "1" : "0");
      return next;
    });
  };
  return { muted, toggle };
}

// ─── FAB actions ─────────────────────────────────────────────────────────────

const FAB_ACTIONS = [
  { key: "voice", icon: Mic, label: "Voice message", color: "#d4673a" },
  { key: "text", icon: MessageSquare, label: "Text message", color: "#8a6035" },
  {
    key: "photo",
    icon: ImageIcon,
    label: "Photo from library",
    color: "#4a7fc1",
  },
  { key: "camera", icon: Camera, label: "Take a photo", color: "#3a9e6a" },
  { key: "document", icon: FileText, label: "Document", color: "#8f52b8" },
] as const;

// ─── Menu Row ─────────────────────────────────────────────────────────────────

function MenuRow({
  icon: Icon,
  label,
  sublabel,
  danger = false,
  disabled = false,
  active = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const baseColor = disabled
    ? "var(--color-text-muted)"
    : danger
      ? hovered
        ? "#ff6b57"
        : "#e05c4a"
      : active
        ? "var(--color-text-primary)"
        : hovered
          ? "var(--color-text-primary)"
          : "var(--color-text-secondary)";

  const iconColor = disabled
    ? "var(--color-text-muted)"
    : danger
      ? hovered
        ? "#ff6b57"
        : "#e05c4a"
      : hovered
        ? "var(--color-text-secondary)"
        : "var(--color-text-muted)";

  const hoverBg = danger ? "rgba(224,92,74,0.11)" : "rgba(184,144,106,0.12)";

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      onHoverStart={() => !disabled && setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileTap={!disabled ? { scale: 0.972 } : {}}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left select-none"
      style={{
        color: baseColor,
        marginLeft: 6,
        marginRight: 6,
        width: "calc(100% - 12px)",
        background: hovered && !disabled ? hoverBg : "transparent",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.13s ease, color 0.13s ease",
      }}
    >
      <motion.span
        animate={{
          x: hovered && !disabled ? 1.5 : 0,
          scale: hovered && !disabled ? 1.08 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
        className="shrink-0 mt-px"
        style={{ display: "flex" }}
      >
        <Icon
          className="h-4 w-4"
          style={{
            color: iconColor,
            transition: "color 0.13s ease",
          }}
        />
      </motion.span>
      <span>
        {label}
        {sublabel && (
          <span
            className="block text-xs font-normal mt-0.5 leading-tight"
            style={{ color: "var(--color-text-muted)", opacity: 0.75 }}
          >
            {sublabel}
          </span>
        )}
      </span>
    </motion.button>
  );
}

// ─── FAB Action Item ──────────────────────────────────────────────────────────

function FabActionItem({
  action,
  index,
  onAction,
}: {
  action: (typeof FAB_ACTIONS)[number];
  index: number;
  onAction: (key: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.86 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.9 }}
      transition={{
        delay: index * 0.045,
        type: "spring",
        stiffness: 440,
        damping: 26,
      }}
      className="flex items-center gap-3"
    >
      {/* Label pill — brightens on hover */}
      <motion.span
        initial={{ opacity: 0, x: 10 }}
        animate={{
          opacity: 1,
          x: 0,
          scale: hovered ? 1.04 : 1,
        }}
        exit={{ opacity: 0, x: 6 }}
        transition={{ delay: index * 0.045 + 0.06 }}
        className="text-xs font-semibold px-2.5 py-1.5 rounded-xl pointer-events-none select-none"
        style={{
          background: hovered
            ? "var(--color-bg-card)"
            : "var(--color-bg-dropdown)",
          color: hovered
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)",
          border: `1px solid ${hovered ? "var(--color-border-card-hover)" : "var(--color-border-card)"}`,
          boxShadow: hovered
            ? `0 4px 16px rgba(0,0,0,0.2), 0 0 0 2px ${action.color}30`
            : "0 2px 10px rgba(0,0,0,0.15)",
          backdropFilter: "blur(14px)",
          transition:
            "background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
        }}
      >
        {action.label}
      </motion.span>

      {/* Colored action button */}
      <motion.button
        onClick={() => onAction(action.key)}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="h-11 w-11 rounded-2xl flex items-center justify-center relative overflow-hidden"
        style={{
          background: action.color,
          boxShadow: hovered
            ? `0 6px 26px ${action.color}90, 0 0 0 3px ${action.color}28`
            : `0 4px 18px ${action.color}55`,
          transition: "box-shadow 0.18s ease",
        }}
        whileHover={{ scale: 1.14, y: -2 }}
        whileTap={{ scale: 0.9 }}
        aria-label={action.label}
      >
        {/* Shine overlay */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 60%)",
          }}
        />
        <action.icon className="h-5 w-5 text-white relative z-10" />
      </motion.button>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DenPageClient({
  den: initialDen,
  currentUserId,
  user,
}: DenPageClientProps) {
  const router = useRouter();
  const [den, setDen] = useState(initialDen);
  const [fabOpen, setFabOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigatingBack, setNavigatingBack] = useState(false);
  const { muted, toggle: toggleMute } = useMuted(den.id);

  const isOwner = den.user_id === currentUserId;

  const [modal, setModal] = useState<
    "rename" | "invite" | "leave" | "delete" | null
  >(null);

  const openModal = (m: typeof modal) => {
    setMenuOpen(false);
    setModal(m);
  };

  const handleBack = () => {
    setNavigatingBack(true);
    startNavigationProgress();
    router.push("/");
  };

  const handleMuteToggle = () => {
    toggleMute();
    setMenuOpen(false);
    toast.success(muted ? "Den unmuted" : "Den muted", {
      description: muted
        ? "You'll receive notifications again."
        : "You won't be notified until you unmute.",
      duration: 2500,
    });
  };

  const handleLeave = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("den_members")
      .delete()
      .eq("den_id", den.id)
      .eq("user_id", currentUserId);
    if (error) {
      toast.error("Failed to leave den", { description: error.message });
      throw error;
    }
    toast.success(`You left ${den.name}`);
    startNavigationProgress();
    router.push("/");
  };

  const handleDelete = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("dens")
      .delete()
      .eq("id", den.id)
      .eq("user_id", currentUserId);
    if (error) {
      toast.error("Failed to delete den", { description: error.message });
      throw error;
    }
    toast.success(`${den.name} deleted`);
    startNavigationProgress();
    router.push("/");
  };

  const handleFabAction = (key: string) => {
    setFabOpen(false);
    const labels: Record<string, string> = {
      voice: "Voice recorder coming soon",
      text: "Text composer coming soon",
      photo: "Photo picker coming soon",
      camera: "Camera coming soon",
      document: "Document picker coming soon",
    };
    toast(labels[key] ?? "Coming soon", { duration: 2000 });
  };

  return (
    <>
      {/* Tap-away overlay */}
      {(menuOpen || fabOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setMenuOpen(false);
            setFabOpen(false);
          }}
        />
      )}

      <div className="min-h-screen page-bg">
        <div
          className="fixed inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
            backgroundSize: "150px",
          }}
        />

        <TopNav user={user} />

        <main className="relative z-10 max-w-4xl mx-auto px-4 pt-8 pb-32">
          {/* ── Top bar ── */}
          <div className="flex items-center justify-between mb-8">
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

            {/* ── Three-dots menu ── */}
            <div className="relative z-40">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                  setFabOpen(false);
                }}
                className="icon-btn h-9 w-9 flex items-center justify-center rounded-xl"
                style={{ color: "var(--color-text-secondary)" }}
                aria-label="Den options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.93, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: -6 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-2 w-56 rounded-2xl py-1.5 overflow-hidden"
                    style={{
                      background: "var(--color-bg-dropdown)",
                      border: "1.5px solid var(--color-border-card)",
                      boxShadow:
                        "0 10px 36px rgba(0,0,0,0.24), 0 1px 0 rgba(255,255,255,0.05) inset",
                      backdropFilter: "blur(24px) saturate(1.7)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Rename — owner only */}
                    <MenuRow
                      icon={Pencil}
                      label="Rename den"
                      disabled={!isOwner}
                      sublabel={
                        !isOwner ? "Only the owner can rename" : undefined
                      }
                      onClick={() => isOwner && openModal("rename")}
                    />

                    {/* Invite members */}
                    <MenuRow
                      icon={UserPlus}
                      label="Invite members"
                      onClick={() => openModal("invite")}
                    />

                    {/* Mute / unmute */}
                    <MenuRow
                      icon={muted ? Bell : BellOff}
                      label={muted ? "Unmute den" : "Mute den"}
                      active={muted}
                      sublabel={muted ? "Notifications paused" : undefined}
                      onClick={handleMuteToggle}
                    />

                    {/* Divider */}
                    <div
                      className="my-1.5 mx-3 h-px"
                      style={{ background: "var(--color-border-card)" }}
                    />

                    {/* Leave — non-owners only */}
                    {!isOwner && (
                      <MenuRow
                        icon={LogOut}
                        label="Leave den"
                        danger
                        onClick={() => openModal("leave")}
                      />
                    )}

                    {/* Delete — owner only */}
                    <MenuRow
                      icon={Trash2}
                      label="Delete den"
                      danger
                      disabled={!isOwner}
                      sublabel={
                        !isOwner ? "Only the owner can delete" : undefined
                      }
                      onClick={() => isOwner && openModal("delete")}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Den header ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-10"
          >
            <h1
              className="text-3xl font-bold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {den.name}
            </h1>
            <p
              className="mt-1.5 text-sm flex items-center flex-wrap gap-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              Created{" "}
              {new Date(den.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {isOwner && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: "rgba(138,96,53,0.14)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Owner
                </span>
              )}
              {muted && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: "rgba(100,100,100,0.1)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <BellOff className="h-3 w-3" />
                  Muted
                </span>
              )}
            </p>
          </motion.div>

          {/* ── Empty state ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="rounded-2xl p-14 text-center"
            style={{
              background: "var(--color-bg-card)",
              border: "1.5px dashed var(--color-border-card)",
            }}
          >
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(138,96,53,0.09)" }}
            >
              <MessageSquare
                className="h-5 w-5"
                style={{ color: "var(--color-text-muted)" }}
              />
            </div>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {den.name} is ready
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Tap the{" "}
              <strong style={{ color: "var(--color-text-secondary)" }}>
                +
              </strong>{" "}
              button to send a voice message, text, or media.
            </p>
          </motion.div>
        </main>

        {/* ── Floating Action Button ── */}
        <div className="fixed bottom-7 right-7 z-40 flex flex-col items-end gap-3">
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex flex-col-reverse gap-2.5 items-end"
              >
                {FAB_ACTIONS.map((action, i) => (
                  <FabActionItem
                    key={action.key}
                    action={action}
                    index={i}
                    onAction={handleFabAction}
                  />
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
            className="h-14 w-14 rounded-[18px] flex items-center justify-center"
            style={{
              background: "var(--color-btn-default-bg)",
              boxShadow: fabOpen
                ? "0 4px 16px var(--color-btn-default-shadow)"
                : "0 6px 28px var(--color-btn-default-shadow)",
            }}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.91 }}
            aria-label={fabOpen ? "Close" : "Add content"}
          >
            <motion.div
              animate={{ rotate: fabOpen ? 45 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
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
        {modal === "rename" && (
          <RenameModal
            den={den}
            onClose={() => setModal(null)}
            onRenamed={(newName) => setDen({ ...den, name: newName })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === "invite" && (
          <InviteModal den={den} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === "leave" && (
          <ConfirmModal
            title={`Leave ${den.name}?`}
            description="You'll lose access to this den and all its content. You'd need a new invite to rejoin."
            confirmLabel="Leave den"
            onClose={() => setModal(null)}
            onConfirm={handleLeave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === "delete" && (
          <ConfirmModal
            title={`Delete ${den.name}?`}
            description="This will permanently delete the den and all its messages and media. This cannot be undone."
            confirmLabel="Delete forever"
            onClose={() => setModal(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </>
  );
}
