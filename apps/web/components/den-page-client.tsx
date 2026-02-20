"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  LinkIcon,
  Loader2,
  Check,
  AlertTriangle,
  Copy,
  Send,
  Users,
  Crown,
  LogOut,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Den {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
}

interface DenMember {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profiles?: { full_name: string | null; email: string };
}

interface DenPageClientProps {
  den: Den;
  currentUserId: string;
  user: { name: string; email: string };
  members: DenMember[];
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({
  onClose,
  children,
  maxWidth = "max-w-sm",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

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
        style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(8px)" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 10 }}
        transition={{ type: "spring", stiffness: 440, damping: 34 }}
        className={`relative w-full ${maxWidth} rounded-2xl p-6`}
        style={{
          background: "var(--color-bg-card)",
          border: "1.5px solid var(--color-border-card)",
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.06) inset",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="icon-btn absolute right-4 top-4 rounded-xl p-1.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

// ─── HoverButton ──────────────────────────────────────────────────────────────

function HoverButton({
  variant = "primary",
  onClick,
  disabled = false,
  className = "",
  children,
}: {
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const styleMap: Record<string, React.CSSProperties> = {
    primary: {
      background: hovered
        ? "var(--color-btn-default-bg-hover)"
        : "var(--color-btn-default-bg)",
      color: "var(--color-btn-default-text)",
      boxShadow: hovered
        ? "0 6px 20px var(--color-btn-default-shadow)"
        : "0 3px 12px var(--color-btn-default-shadow)",
    },
    secondary: {
      background: hovered
        ? "var(--color-btn-secondary-bg-hover)"
        : "var(--color-btn-secondary-bg)",
      color: "var(--color-btn-secondary-text)",
    },
    danger: {
      background: hovered ? "#a93226" : "#c0392b",
      color: "#fff",
      boxShadow: hovered
        ? "0 6px 20px rgba(192,57,43,0.45)"
        : "0 3px 12px rgba(192,57,43,0.28)",
    },
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={!disabled ? { y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      className={`rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={styleMap[variant]}
    >
      {children}
    </motion.button>
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
      const { error: dbErr } = await supabase
        .from("dens")
        .update({ name: trimmed })
        .eq("id", den.id);
      if (dbErr) throw dbErr;
      onRenamed(trimmed);
      toast.success("Den renamed", { description: `Now called "${trimmed}"` });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename.");
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(138,96,53,0.12)" }}
        >
          <Pencil
            className="h-4 w-4"
            style={{ color: "var(--color-avatar-bg)" }}
          />
        </div>
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Rename den
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            All members will see the new name instantly
          </p>
        </div>
      </div>
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
        placeholder="Den name"
        autoFocus
      />
      {error ? (
        <p className="text-xs mb-3" style={{ color: "#e07050" }}>
          {error}
        </p>
      ) : (
        <div className="mb-3" />
      )}
      <div className="flex gap-2 mt-1">
        <HoverButton
          variant="secondary"
          onClick={onClose}
          className="flex-1 py-2.5 text-sm"
        >
          Cancel
        </HoverButton>
        <HoverButton
          variant="primary"
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="flex-1 py-2.5 text-sm"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Save
            </>
          )}
        </HoverButton>
      </div>
    </ModalShell>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ den, onClose }: { den: Den; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteLink = inviteToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inviteToken}`
    : null;

  useEffect(() => {
    const generate = async () => {
      setGeneratingLink(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("den_invites")
          .insert({ den_id: den.id, invited_by: user.id })
          .select("token")
          .single();
        if (!error && data) setInviteToken(data.token);
      } finally {
        setGeneratingLink(false);
      }
    };
    generate();
  }, [den.id]);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) return;
    setSending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("den_invites")
        .insert({ den_id: den.id, invited_by: user.id, email: trimmed });
      toast.success(`Invite sent to ${trimmed}`, {
        description: "They'll receive a link to join.",
      });
      setEmail("");
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(74,127,193,0.12)" }}
        >
          <UserPlus className="h-4 w-4" style={{ color: "#4a7fc1" }} />
        </div>
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Invite to {den.name}
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Links expire in 7 days
          </p>
        </div>
      </div>

      <p
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: "var(--color-text-muted)" }}
      >
        Invite by email
      </p>
      <div className="flex gap-2 mb-5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="friend@example.com"
          className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
          autoFocus
        />
        <HoverButton
          variant="primary"
          onClick={handleSend}
          disabled={sending || !email.includes("@")}
          className="px-4 py-2.5 text-sm shrink-0"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Send
            </>
          )}
        </HoverButton>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex-1 h-px"
          style={{ background: "var(--color-border-card)" }}
        />
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          or share a link
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "var(--color-border-card)" }}
        />
      </div>

      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3"
        style={{
          background: "var(--color-input-bg)",
          border: "1.5px solid var(--color-input-border)",
        }}
      >
        <LinkIcon
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: "var(--color-text-muted)" }}
        />
        {generatingLink ? (
          <span
            className="text-xs flex-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Generating link…
          </span>
        ) : (
          <span
            className="text-xs font-mono flex-1 truncate"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {inviteLink ?? "—"}
          </span>
        )}
      </div>
      <HoverButton
        variant="primary"
        onClick={handleCopy}
        disabled={!inviteLink || generatingLink}
        className="w-full py-2.5 text-sm"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy invite link
          </>
        )}
      </HoverButton>
    </ModalShell>
  );
}

// ─── Members Modal ────────────────────────────────────────────────────────────

function MembersModal({
  den,
  members,
  currentUserId,
  isOwner,
  onClose,
  onMemberRemoved,
}: {
  den: Den;
  members: DenMember[];
  currentUserId: string;
  isOwner: boolean;
  onClose: () => void;
  onMemberRemoved: (userId: string) => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = async (userId: string, displayName: string) => {
    setRemoving(userId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("den_members")
        .delete()
        .eq("den_id", den.id)
        .eq("user_id", userId);
      if (error) throw error;
      onMemberRemoved(userId);
      toast.success(`${displayName} removed from ${den.name}`);
    } catch (err: unknown) {
      toast.error("Failed to remove member", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(138,96,53,0.12)" }}
        >
          <Users
            className="h-4 w-4"
            style={{ color: "var(--color-avatar-bg)" }}
          />
        </div>
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Members
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {members.length} {members.length === 1 ? "person" : "people"} in{" "}
            {den.name}
          </p>
        </div>
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin -mx-1 px-1">
        {members.map((m) => {
          const displayName =
            m.profiles?.full_name ?? m.profiles?.email ?? m.user_id.slice(0, 8);
          const isYou = m.user_id === currentUserId;
          const isMemberOwner = m.role === "owner";
          return (
            <div
              key={m.user_id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "var(--color-btn-secondary-bg)" }}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: "var(--color-avatar-bg)" }}
              >
                {displayName[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {displayName}
                  {isYou && (
                    <span
                      className="ml-1.5 text-xs font-normal"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      (you)
                    </span>
                  )}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {new Date(m.joined_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              {isMemberOwner && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: "rgba(138,96,53,0.14)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <Crown className="h-3 w-3" />
                  Owner
                </span>
              )}
              {isOwner && !isMemberOwner && (
                <button
                  onClick={() => handleRemove(m.user_id, displayName)}
                  disabled={removing === m.user_id}
                  className="icon-btn h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ color: "#e05c4a" }}
                  aria-label={`Remove ${displayName}`}
                >
                  {removing === m.user_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}

// ─── Mute Modal ───────────────────────────────────────────────────────────────

function MuteModal({
  muted,
  onClose,
  onToggle,
}: {
  den: Den;
  muted: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  const handleConfirm = () => {
    onToggle();
    toast.success(muted ? "Den unmuted" : "Den muted", {
      description: muted
        ? "You'll receive notifications again."
        : "You won't be notified for new activity.",
      duration: 3000,
    });
    onClose();
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(120,120,120,0.1)" }}
        >
          {muted ? (
            <Bell
              className="h-4 w-4"
              style={{ color: "var(--color-text-secondary)" }}
            />
          ) : (
            <BellOff
              className="h-4 w-4"
              style={{ color: "var(--color-text-secondary)" }}
            />
          )}
        </div>
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {muted ? "Unmute den" : "Mute den"}
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Only affects you — not other members
          </p>
        </div>
      </div>
      <p
        className="text-sm mb-6 leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {muted
          ? "You'll start receiving notifications for new messages and activity in this den."
          : "You won't receive notifications from this den. You can still read messages when you visit."}
      </p>
      <div className="flex gap-2">
        <HoverButton
          variant="secondary"
          onClick={onClose}
          className="flex-1 py-2.5 text-sm"
        >
          Cancel
        </HoverButton>
        <HoverButton
          variant="primary"
          onClick={handleConfirm}
          className="flex-1 py-2.5 text-sm"
        >
          {muted ? (
            <>
              <Bell className="h-3.5 w-3.5" />
              Unmute
            </>
          ) : (
            <>
              <BellOff className="h-3.5 w-3.5" />
              Mute den
            </>
          )}
        </HoverButton>
      </div>
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
        className="text-lg font-bold mb-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h2>
      <p
        className="text-sm mb-6 leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {description}
      </p>
      <div className="flex gap-2">
        <HoverButton
          variant="secondary"
          onClick={onClose}
          className="flex-1 py-2.5 text-sm"
        >
          Cancel
        </HoverButton>
        <HoverButton
          variant="danger"
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 py-2.5 text-sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            confirmLabel
          )}
        </HoverButton>
      </div>
    </ModalShell>
  );
}

// ─── Menu Row ─────────────────────────────────────────────────────────────────

function MenuRow({
  icon: Icon,
  label,
  sublabel,
  danger = false,
  disabled = false,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  danger?: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const textColor = disabled
    ? "var(--color-text-muted)"
    : danger
      ? hovered
        ? "#ff6e5a"
        : "#e05c4a"
      : hovered
        ? "var(--color-text-primary)"
        : "var(--color-text-secondary)";

  const iconColor = disabled
    ? "var(--color-text-muted)"
    : danger
      ? hovered
        ? "#ff6e5a"
        : "#e05c4a"
      : hovered
        ? "var(--color-avatar-bg)"
        : "var(--color-text-muted)";

  const bgColor =
    hovered && !disabled
      ? danger
        ? "rgba(224,92,74,0.1)"
        : "rgba(138,96,53,0.09)"
      : "transparent";

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm text-left select-none"
      style={{
        color: textColor,
        background: bgColor,
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        margin: "0 5px",
        width: "calc(100% - 10px)",
        transition: "background 0.12s ease, color 0.12s ease",
        border: "none",
        outline: "none",
      }}
    >
      <span
        style={{
          display: "flex",
          flexShrink: 0,
          transition: "transform 0.15s ease",
          transform: hovered && !disabled ? "scale(1.14)" : "scale(1)",
        }}
      >
        <Icon
          className="h-4 w-4"
          style={{ color: iconColor, transition: "color 0.12s ease" }}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate font-medium leading-tight">
          {label}
        </span>
        {sublabel && (
          <span
            className="block text-xs mt-0.5 truncate font-normal leading-tight"
            style={{ color: "var(--color-text-muted)", opacity: 0.8 }}
          >
            {sublabel}
          </span>
        )}
      </span>
      {badge && <span className="shrink-0 ml-1">{badge}</span>}
      {!disabled && (
        <span
          className="shrink-0 text-xs leading-none"
          style={{
            color: danger ? "#e05c4a" : "var(--color-text-muted)",
            opacity: hovered ? 0.45 : 0,
            transform: hovered ? "translateX(3px)" : "translateX(0)",
            transition: "opacity 0.15s ease, transform 0.15s ease",
          }}
        >
          ›
        </span>
      )}
    </button>
  );
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

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
      initial={{ opacity: 0, y: 16, scale: 0.84 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.88 }}
      transition={{
        delay: index * 0.045,
        type: "spring",
        stiffness: 460,
        damping: 28,
      }}
      className="flex items-center gap-3"
    >
      <motion.span
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0, scale: hovered ? 1.04 : 1 }}
        exit={{ opacity: 0, x: 8 }}
        transition={{ delay: index * 0.045 + 0.055 }}
        className="text-xs font-semibold px-2.5 py-1.5 rounded-xl pointer-events-none select-none whitespace-nowrap"
        style={{
          background: hovered
            ? "var(--color-bg-card)"
            : "var(--color-bg-dropdown)",
          color: hovered
            ? "var(--color-text-primary)"
            : "var(--color-text-secondary)",
          border: `1px solid ${hovered ? "var(--color-border-card-hover)" : "var(--color-border-card)"}`,
          boxShadow: hovered
            ? `0 4px 18px rgba(0,0,0,0.22), 0 0 0 2px ${action.color}28`
            : "0 2px 10px rgba(0,0,0,0.14)",
          backdropFilter: "blur(16px)",
          transition: "all 0.16s ease",
        }}
      >
        {action.label}
      </motion.span>
      <motion.button
        onClick={() => onAction(action.key)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="h-11 w-11 rounded-2xl flex items-center justify-center relative overflow-hidden shrink-0"
        style={{
          background: action.color,
          boxShadow: hovered
            ? `0 8px 28px ${action.color}88, 0 0 0 3px ${action.color}24`
            : `0 4px 16px ${action.color}55`,
          transition: "box-shadow 0.18s ease",
        }}
        whileHover={{ scale: 1.13, y: -2.5 }}
        whileTap={{ scale: 0.9 }}
        aria-label={action.label}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.24) 0%, transparent 55%)",
          }}
        />
        <action.icon className="h-5 w-5 text-white relative z-10" />
      </motion.button>
    </motion.div>
  );
}

// ─── Muted badge + hook ───────────────────────────────────────────────────────

function MutedBadge() {
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        background: "rgba(120,120,120,0.14)",
        color: "var(--color-text-muted)",
      }}
    >
      On
    </span>
  );
}

function useMuted(denId: string) {
  const key = `muted_den_${denId}`;
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    setMuted(localStorage.getItem(key) === "1");
  }, [key]);
  const toggle = () =>
    setMuted((v) => {
      const n = !v;
      localStorage.setItem(key, n ? "1" : "0");
      return n;
    });
  return { muted, toggle };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DenPageClient({
  den: initialDen,
  currentUserId,
  user,
  members: initialMembers,
}: DenPageClientProps) {
  const router = useRouter();
  const [den, setDen] = useState(initialDen);
  const [members, setMembers] = useState<DenMember[]>(initialMembers);
  const [fabOpen, setFabOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigatingBack, setNavigatingBack] = useState(false);
  const { muted, toggle: toggleMute } = useMuted(den.id);
  const isOwner = den.user_id === currentUserId;
  const menuRef = useRef<HTMLDivElement>(null);

  type ModalType =
    | "rename"
    | "invite"
    | "members"
    | "mute"
    | "leave"
    | "delete"
    | null;
  const [modal, setModal] = useState<ModalType>(null);
  const openModal = (m: ModalType) => {
    setMenuOpen(false);
    setModal(m);
  };
  const closeModal = () => setModal(null);

  // ── Close menu on outside click ───────────────────────────────────────────
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

  // ── Close FAB on outside click ────────────────────────────────────────────
  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e: MouseEvent) => {
      // Let FAB button clicks through
      if ((e.target as HTMLElement).closest("[data-fab]")) return;
      setFabOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fabOpen]);

  // ── Realtime subscriptions ────────────────────────────────────────────────

  const handleDenUpdate = useCallback((payload: { new: Den }) => {
    setDen(payload.new);
    toast.info(`Den renamed to "${payload.new.name}"`, { duration: 2500 });
  }, []);

  const handleDenDelete = useCallback(() => {
    toast.error("This den was deleted by the owner", { duration: 4000 });
    startNavigationProgress();
    router.push("/");
  }, [router]);

  const handleMemberInsert = useCallback((payload: { new: DenMember }) => {
    setMembers((prev) => {
      if (prev.find((m) => m.user_id === payload.new.user_id)) return prev;
      return [...prev, payload.new];
    });
  }, []);

  const handleMemberDelete = useCallback(
    (payload: { old: { user_id: string } }) => {
      if (payload.old.user_id === currentUserId) {
        toast.error("You've been removed from this den", { duration: 4000 });
        startNavigationProgress();
        router.push("/");
        return;
      }
      setMembers((prev) =>
        prev.filter((m) => m.user_id !== payload.old.user_id),
      );
    },
    [currentUserId, router],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`den-realtime-${den.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dens",
          filter: `id=eq.${den.id}`,
        },
        (payload) => {
          if ((payload.new as Den).user_id !== currentUserId) {
            handleDenUpdate(payload as unknown as { new: Den });
          } else {
            setDen(payload.new as Den);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "dens",
          filter: `id=eq.${den.id}`,
        },
        handleDenDelete,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "den_members",
          filter: `den_id=eq.${den.id}`,
        },
        (payload) =>
          handleMemberInsert(payload as unknown as { new: DenMember }),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "den_members",
          filter: `den_id=eq.${den.id}`,
        },
        (payload) =>
          handleMemberDelete(
            payload as unknown as { old: { user_id: string } },
          ),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    den.id,
    currentUserId,
    handleDenUpdate,
    handleDenDelete,
    handleMemberInsert,
    handleMemberDelete,
  ]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleBack = () => {
    setNavigatingBack(true);
    startNavigationProgress();
    router.push("/");
  };

  const handleLeave = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("den_members")
      .delete()
      .eq("den_id", den.id)
      .eq("user_id", currentUserId);
    if (error) {
      toast.error("Failed to leave", { description: error.message });
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
      toast.error("Failed to delete", { description: error.message });
      throw error;
    }
    toast.success(`"${den.name}" deleted`);
    startNavigationProgress();
    router.push("/");
  };

  const handleFabAction = (key: string) => {
    setFabOpen(false);
    const messages: Record<string, string> = {
      voice: "Voice recorder coming soon",
      text: "Text composer coming soon",
      photo: "Photo picker coming soon",
      camera: "Camera coming soon",
      document: "Document picker coming soon",
    };
    toast(messages[key] ?? "Coming soon", { duration: 2200 });
  };

  const memberCount = members.length;

  return (
    <>
      <div className="min-h-screen page-bg">
        <div
          className="fixed inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
            backgroundSize: "150px",
          }}
        />

        <TopNav user={user} />

        <main className="max-w-4xl mx-auto px-4 pt-8 pb-32">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
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
              Back to dens
            </button>

            {/* Three-dots menu — NOTE: no z-index on parent, menu itself uses fixed positioning */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <motion.button
                onClick={() => {
                  setMenuOpen((v) => !v);
                  setFabOpen(false);
                }}
                className="icon-btn h-9 w-9 flex items-center justify-center rounded-xl"
                whileTap={{ scale: 0.9 }}
                style={{
                  color: menuOpen
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                  background: menuOpen
                    ? "var(--color-nav-item-hover-bg)"
                    : "transparent",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
                aria-label="Den options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </motion.button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.91, y: -12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: -6 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      position: "fixed",
                      top: (() => {
                        const el = menuRef.current;
                        if (!el) return 60;
                        const rect = el.getBoundingClientRect();
                        return rect.bottom + 8;
                      })(),
                      right: (() => {
                        const el = menuRef.current;
                        if (!el) return 16;
                        return (
                          window.innerWidth - el.getBoundingClientRect().right
                        );
                      })(),
                      width: 224,
                      zIndex: 9999,
                      background: "var(--color-bg-dropdown)",
                      border: "1.5px solid var(--color-border-card)",
                      boxShadow:
                        "0 14px 44px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.08) inset",
                      backdropFilter: "blur(28px) saturate(1.8)",
                      borderRadius: 16,
                      padding: "6px",
                    }}
                  >
                    <div className="px-2.5 pt-1.5 pb-1">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{
                          color: "var(--color-text-muted)",
                          opacity: 0.6,
                        }}
                      >
                        Manage
                      </span>
                    </div>

                    <MenuRow
                      icon={Pencil}
                      label="Rename den"
                      disabled={!isOwner}
                      sublabel={!isOwner ? "Owner only" : undefined}
                      onClick={() => openModal("rename")}
                    />
                    <MenuRow
                      icon={UserPlus}
                      label="Invite members"
                      onClick={() => openModal("invite")}
                    />
                    <MenuRow
                      icon={Users}
                      label="View members"
                      badge={
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            background: "rgba(138,96,53,0.14)",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {memberCount}
                        </span>
                      }
                      onClick={() => openModal("members")}
                    />
                    <MenuRow
                      icon={muted ? Bell : BellOff}
                      label={muted ? "Unmute den" : "Mute den"}
                      badge={muted ? <MutedBadge /> : undefined}
                      onClick={() => openModal("mute")}
                    />

                    <div
                      className="my-1.5 mx-1"
                      style={{
                        height: 1,
                        background: "var(--color-border-card)",
                      }}
                    />

                    <div className="px-2.5 pt-0.5 pb-1">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "rgba(224,92,74,0.5)" }}
                      >
                        Danger zone
                      </span>
                    </div>

                    {!isOwner && (
                      <MenuRow
                        icon={LogOut}
                        label="Leave den"
                        danger
                        onClick={() => openModal("leave")}
                      />
                    )}
                    <MenuRow
                      icon={Trash2}
                      label="Delete den"
                      danger
                      disabled={!isOwner}
                      sublabel={!isOwner ? "Owner only" : undefined}
                      onClick={() => openModal("delete")}
                    />
                    <div className="h-1" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Den header */}
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
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: "rgba(138,96,53,0.12)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <Crown className="h-3 w-3" />
                  Owner
                </span>
              )}
              <button
                onClick={() => openModal("members")}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70"
                style={{
                  background: "rgba(138,96,53,0.08)",
                  color: "var(--color-text-muted)",
                }}
              >
                <Users className="h-3 w-3" />
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </button>
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

          {/* Empty state */}
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
              Tap{" "}
              <strong style={{ color: "var(--color-text-secondary)" }}>
                +
              </strong>{" "}
              to send a voice message, text, or media.
            </p>
          </motion.div>
        </main>

        {/* FAB */}
        <div
          data-fab
          className="fixed bottom-7 right-7 z-40 flex flex-col items-end gap-3"
        >
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

      {/* Modals */}
      <AnimatePresence>
        {modal === "rename" && (
          <RenameModal
            den={den}
            onClose={closeModal}
            onRenamed={(name) => setDen({ ...den, name })}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "invite" && <InviteModal den={den} onClose={closeModal} />}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "members" && (
          <MembersModal
            den={den}
            members={members}
            currentUserId={currentUserId}
            isOwner={isOwner}
            onClose={closeModal}
            onMemberRemoved={(uid) =>
              setMembers((prev) => prev.filter((m) => m.user_id !== uid))
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "mute" && (
          <MuteModal
            den={den}
            muted={muted}
            onClose={closeModal}
            onToggle={toggleMute}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "leave" && (
          <ConfirmModal
            title={`Leave ${den.name}?`}
            description="You'll lose access to this den. You'd need a new invite to rejoin."
            confirmLabel="Leave den"
            onClose={closeModal}
            onConfirm={handleLeave}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "delete" && (
          <ConfirmModal
            title={`Delete "${den.name}"?`}
            description="This will permanently delete the den for all members. Everyone will be notified and removed. This cannot be undone."
            confirmLabel="Delete forever"
            onClose={closeModal}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </>
  );
}
