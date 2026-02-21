"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { TopNav } from "@/components/top-nav";
import { Button } from "@meerkat/ui";
import { Input } from "@meerkat/ui";
import { Label } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme-provider";
import {
  User,
  Bell,
  Shield,
  Palette,
  Check,
  Loader2,
  AlertTriangle,
  LogOut,
  X,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  Trash2,
} from "lucide-react";

interface SettingsPageClientProps {
  user: {
    id: string;
    name: string;
    preferredName: string;
    email: string;
    notifPrefs?: {
      emailActivity: boolean;
      emailDigest: boolean;
      pushMessages: boolean;
      pushMentions: boolean;
    };
  };
}

type Section = "profile" | "notifications" | "appearance" | "security";

const sections = [
  { id: "profile" as Section, label: "Profile", icon: User },
  { id: "notifications" as Section, label: "Notifications", icon: Bell },
  { id: "appearance" as Section, label: "Appearance", icon: Palette },
  { id: "security" as Section, label: "Security", icon: Shield },
];

// ── Shared Components ────────────────────────────────────────────────────────

function SectionCard({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "var(--color-bg-card)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        border: "1.5px solid var(--color-border-card)",
        boxShadow: "var(--color-shadow-card)",
      }}
    >
      <div className="mb-5">
        <h3
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="toggle-btn relative inline-flex h-6 w-11 shrink-0 items-center rounded-full focus:outline-none transition-colors duration-200"
      style={{
        background: checked ? "var(--color-avatar-bg)" : "rgba(139,111,71,0.2)",
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(26px)" : "translateX(2px)" }}
      />
    </button>
  );
}

/** Accessible confirmation modal */
function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  confirmVariant = "danger",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: "danger" | "default";
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(4px)",
            }}
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative w-full max-w-sm rounded-2xl p-6 z-10"
            style={{
              background: "var(--color-bg-card)",
              border: "1.5px solid var(--color-border-card)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
            }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(192, 57, 43, 0.12)" }}
            >
              <AlertTriangle className="h-6 w-6" style={{ color: "#c0392b" }} />
            </div>

            <h2
              className="text-base font-bold mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              {title}
            </h2>
            <div
              className="text-sm leading-relaxed mb-6"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {body}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium border transition-opacity hover:opacity-75 disabled:opacity-50"
                style={{
                  borderColor: "var(--color-border-card)",
                  color: "var(--color-text-secondary)",
                  background: "transparent",
                }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity hover:opacity-90"
                style={
                  confirmVariant === "danger"
                    ? { background: "#c0392b", color: "#fff" }
                    : {
                        background: "var(--color-btn-default-bg)",
                        color: "var(--color-btn-default-text)",
                      }
                }
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const THEME_OPTIONS = [
  {
    value: "light" as const,
    label: "Light",
    preview: "linear-gradient(135deg, #f5e6d3, #d4a574)",
    cardBg: "rgba(255,248,240,0.9)",
    labelColor: "#3a2718",
  },
  {
    value: "dark" as const,
    label: "Dark",
    preview: "linear-gradient(135deg, #1a0f08, #3a200a)",
    cardBg: "rgba(30,18,8,0.9)",
    labelColor: "#e8d5bc",
  },
  {
    value: "system" as const,
    label: "System",
    preview:
      "linear-gradient(135deg, #f5e6d3 0%, #f5e6d3 50%, #1a0f08 50%, #3a200a 100%)",
    cardBg: "rgba(139,111,71,0.15)",
    labelColor: "var(--color-text-primary)",
  },
] as const;

// ── Main Component ────────────────────────────────────────────────────────────

export function SettingsPageClient({ user }: SettingsPageClientProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<Section>("profile");

  // Profile
  const [name, setName] = useState(user.name);
  const [preferredName, setPreferredName] = useState(user.preferredName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Notifications — seed from user_metadata if available
  const [notifs, setNotifs] = useState({
    emailActivity: user.notifPrefs?.emailActivity ?? true,
    emailDigest: user.notifPrefs?.emailDigest ?? false,
    pushMessages: user.notifPrefs?.pushMessages ?? true,
    pushMentions: user.notifPrefs?.pushMentions ?? true,
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  // Sign out
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Delete account modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Sessions
  interface SessionInfo {
    id: string;
    browser: string;
    os: string;
    device: string;
    location: string;
    ip: string;
    createdAt: string;
    lastActiveAt: string;
    isCurrent: boolean;
  }
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/account/sessions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessions(data.sessions ?? []);
    } catch {
      toast.error("Could not load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "security") fetchSessions();
  }, [activeSection, fetchSessions]);

  const handleRevokeSession = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/account/sessions?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Session revoked");
    } catch (err: unknown) {
      toast.error("Could not revoke session", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setRevokingId(null);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: name,
          preferred_name: preferredName.trim() || name,
        },
      });
      if (error) throw error;
      router.refresh();
      toast.success("Profile updated", {
        description: "Your changes have been saved.",
      });
    } catch (err: unknown) {
      toast.error("Failed to save", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSavingNotifs(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { notification_prefs: notifs },
      });
      if (error) throw error;
      toast.success("Notification preferences saved");
    } catch (err: unknown) {
      toast.error("Failed to save preferences", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setIsSavingNotifs(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent", {
        description: `Check ${user.email} for the password reset link.`,
      });
    } catch (err: unknown) {
      toast.error("Failed to send reset link", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  };

  const handleSignOutAll = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
      router.push("/login");
    } catch (err: unknown) {
      toast.error("Failed to sign out", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Deletion failed");
      }
      toast.success("Account deleted", {
        description: "Your account and all data have been permanently removed.",
      });
      router.push("/login");
    } catch (err: unknown) {
      toast.error("Failed to delete account", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  const avatarInitials = (preferredName || name)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen page-bg">
      {/* Noise texture */}
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          backgroundSize: "150px",
        }}
      />

      <TopNav user={{ name, email: user.email }} />

      <main className="relative z-10 max-w-4xl mx-auto px-4 pb-16">
        <motion.div
          initial={{ y: 12 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Settings
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Manage your account and preferences
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* ── Sidebar ── */}
          <motion.aside
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="sm:w-48 shrink-0"
          >
            <div
              className="rounded-2xl p-1.5"
              style={{
                background: "var(--color-bg-sidebar)",
                backdropFilter: "blur(20px) saturate(1.5)",
                WebkitBackdropFilter: "blur(20px) saturate(1.5)",
                border: "1.5px solid var(--color-border-nav)",
                boxShadow: "0 4px 24px rgba(90,55,20,0.07)",
              }}
            >
              {sections.map(({ id, label, icon: Icon }) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`settings-nav-item ${active ? "settings-nav-active" : ""} w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150`}
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.15)"
                        : "transparent",
                      color: active
                        ? "var(--color-text-primary)"
                        : "var(--color-text-secondary)",
                      boxShadow: active
                        ? "0 1px 4px rgba(90,55,20,0.1), 0 0 0 1px rgba(255,255,255,0.35) inset"
                        : "none",
                    }}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0 transition-transform duration-150"
                      style={{
                        color: active
                          ? "var(--color-text-primary)"
                          : "var(--color-text-muted)",
                        transform: active ? "scale(1.1)" : "scale(1)",
                      }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </motion.aside>

          {/* ── Content ── */}
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col gap-4"
          >
            {/* ── PROFILE ── */}
            {activeSection === "profile" && (
              <>
                <SectionCard
                  title="Personal Info"
                  subtitle="Update your name and display preferences"
                >
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="full-name">Full name</Label>
                      <Input
                        id="full-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="preferred-name">Preferred name</Label>
                      <Input
                        id="preferred-name"
                        value={preferredName}
                        onChange={(e) => setPreferredName(e.target.value)}
                        placeholder="What we call you"
                      />
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Used to greet you when you sign in
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email-display">Email</Label>
                      <Input
                        id="email-display"
                        value={user.email}
                        disabled
                        className="opacity-60 cursor-not-allowed"
                      />
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Email cannot be changed here
                      </p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="min-w-[120px]"
                      >
                        {isSavingProfile ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save changes"
                        )}
                      </Button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Avatar"
                  subtitle="Your avatar is generated from your initials"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0 transition-transform duration-150 hover:scale-105"
                      style={{ background: "var(--color-avatar-bg)" }}
                    >
                      {avatarInitials}
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {preferredName || name}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Custom avatar upload coming soon
                      </p>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeSection === "notifications" && (
              <SectionCard
                title="Notification Preferences"
                subtitle="Choose what you hear about and how"
              >
                <div className="space-y-0 divide-y divide-meerkat-tan/20">
                  {[
                    {
                      key: "emailActivity",
                      label: "Email — Activity",
                      desc: "Messages and replies in your dens",
                    },
                    {
                      key: "emailDigest",
                      label: "Email — Weekly digest",
                      desc: "A summary of activity across your dens",
                    },
                    {
                      key: "pushMessages",
                      label: "Push — New messages",
                      desc: "Real-time alerts for new messages",
                    },
                    {
                      key: "pushMentions",
                      label: "Push — Mentions",
                      desc: "Notify when someone mentions you",
                    },
                  ].map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-4 first:pt-0 last:pb-0 rounded-lg px-1 cursor-pointer"
                      onClick={() =>
                        setNotifs((prev) => ({
                          ...prev,
                          [key]: !prev[key as keyof typeof notifs],
                        }))
                      }
                    >
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {label}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {desc}
                        </p>
                      </div>
                      <Toggle
                        checked={notifs[key as keyof typeof notifs]}
                        onChange={(v) =>
                          setNotifs((prev) => ({ ...prev, [key]: v }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-4 border-t border-meerkat-tan/20 mt-2">
                  <Button
                    onClick={handleSaveNotifications}
                    disabled={isSavingNotifs}
                    className="min-w-[140px]"
                  >
                    {isSavingNotifs ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save preferences"
                    )}
                  </Button>
                </div>
              </SectionCard>
            )}

            {/* ── APPEARANCE ── */}
            {activeSection === "appearance" && (
              <SectionCard
                title="Theme"
                subtitle="Choose how Meerkat looks for you"
              >
                <div className="grid grid-cols-3 gap-3">
                  {THEME_OPTIONS.map(
                    ({ value, label, preview, cardBg, labelColor }) => {
                      const active = theme === value;
                      return (
                        <button
                          key={value}
                          onClick={() => {
                            setTheme(value);
                            toast.success(`Theme set to ${label}`, {
                              duration: 1500,
                            });
                          }}
                          className={`theme-option ${active ? "theme-active" : ""} relative rounded-xl p-4 text-left border-2 focus:outline-none transition-all duration-150`}
                          style={{
                            background: cardBg,
                            borderColor: active
                              ? "var(--color-avatar-bg)"
                              : "rgba(139,111,71,0.2)",
                          }}
                        >
                          <div
                            className="h-10 rounded-lg mb-3"
                            style={{ background: preview }}
                          />
                          <p
                            className="text-sm font-medium"
                            style={{ color: labelColor }}
                          >
                            {label}
                          </p>
                          {active && (
                            <div
                              className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full flex items-center justify-center"
                              style={{ background: "var(--color-avatar-bg)" }}
                            >
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
                <p
                  className="text-xs mt-4"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Your preference is saved locally and applied on every visit.
                  System follows your OS setting.
                </p>
              </SectionCard>
            )}

            {/* ── SECURITY ── */}
            {activeSection === "security" && (
              <>
                {/* Password */}
                <SectionCard
                  title="Password"
                  subtitle="Manage your account password"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        Change password
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        We&apos;ll send a reset link to {user.email}
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleChangePassword}>
                      Send reset link
                    </Button>
                  </div>
                </SectionCard>

                {/* Sessions */}
                <SectionCard
                  title="Sessions"
                  subtitle="Manage where you're signed in"
                >
                  {sessionsLoading ? (
                    <div
                      className="flex items-center justify-center py-8 gap-2"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading sessions…</span>
                    </div>
                  ) : sessions.length === 0 ? (
                    <p
                      className="text-sm py-4 text-center"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      No sessions found
                    </p>
                  ) : (
                    <div
                      className="divide-y"
                      style={{ borderColor: "var(--color-border-card)" }}
                    >
                      {sessions.map((s) => {
                        const DeviceIcon =
                          s.device === "iPhone" || s.device === "Android Phone"
                            ? Smartphone
                            : s.device === "iPad" ||
                                s.device === "Android Tablet"
                              ? Tablet
                              : Monitor;
                        const lastActive = new Date(s.lastActiveAt);
                        const now = new Date();
                        const diffMs = now.getTime() - lastActive.getTime();
                        const diffMin = Math.floor(diffMs / 60000);
                        const relativeTime =
                          diffMin < 1
                            ? "Just now"
                            : diffMin < 60
                              ? `${diffMin}m ago`
                              : diffMin < 1440
                                ? `${Math.floor(diffMin / 60)}h ago`
                                : `${Math.floor(diffMin / 1440)}d ago`;

                        return (
                          <div
                            key={s.id}
                            className="flex items-start justify-between py-4 first:pt-0 gap-3"
                          >
                            {/* Device icon */}
                            <div
                              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                              style={{
                                background: s.isCurrent
                                  ? "rgba(184,144,106,0.18)"
                                  : "rgba(139,111,71,0.1)",
                              }}
                            >
                              <DeviceIcon
                                className="h-4 w-4"
                                style={{
                                  color: s.isCurrent
                                    ? "var(--color-avatar-bg)"
                                    : "var(--color-text-muted)",
                                }}
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p
                                  className="text-sm font-medium truncate"
                                  style={{ color: "var(--color-text-primary)" }}
                                >
                                  {s.browser} on {s.os}
                                </p>
                                {s.isCurrent && (
                                  <span
                                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                                    style={{
                                      background: "rgba(34,197,94,0.12)",
                                      color: "#16a34a",
                                    }}
                                  >
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {s.location && (
                                  <span
                                    className="flex items-center gap-1 text-xs"
                                    style={{ color: "var(--color-text-muted)" }}
                                  >
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {s.location}
                                  </span>
                                )}
                                <span
                                  className="flex items-center gap-1 text-xs"
                                  style={{ color: "var(--color-text-muted)" }}
                                >
                                  <Clock className="h-3 w-3 shrink-0" />
                                  {relativeTime}
                                </span>
                              </div>
                            </div>

                            {/* Action */}
                            {s.isCurrent ? (
                              <span
                                className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0 mt-0.5"
                                style={{
                                  background: "rgba(34,197,94,0.12)",
                                  color: "#16a34a",
                                }}
                              >
                                Active
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRevokeSession(s.id)}
                                disabled={revokingId === s.id}
                                className="shrink-0 mt-0.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-opacity hover:opacity-75 disabled:opacity-50"
                                style={{
                                  borderColor: "rgba(192,57,43,0.25)",
                                  color: "#c0392b",
                                  background: "rgba(192,57,43,0.06)",
                                }}
                              >
                                {revokingId === s.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                                Revoke
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Sign out all */}
                  <div
                    className="pt-4 border-t mt-2"
                    style={{ borderColor: "var(--color-border-card)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          Sign out everywhere
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          Signs you out of all browsers and devices
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleSignOutAll}
                        disabled={isSigningOut}
                      >
                        {isSigningOut ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing out…
                          </>
                        ) : (
                          <>
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign out all
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </SectionCard>

                {/* Danger Zone */}
                <SectionCard
                  title="Danger Zone"
                  subtitle="Irreversible actions"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "#c0392b" }}
                      >
                        Delete account
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Permanently delete your account and all data
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                      onClick={() => {
                        setDeleteConfirmText("");
                        setDeleteOpen(true);
                      }}
                    >
                      Delete account
                    </Button>
                  </div>
                </SectionCard>
              </>
            )}
          </motion.div>
        </div>
      </main>

      {/* ── Delete Account Confirmation Modal ── */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => !isDeleting && setDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete your account?"
        body={
          <div className="space-y-3">
            <p>
              This will permanently delete your account, dens you own, and all
              associated data. <strong>This cannot be undone.</strong>
            </p>
            <div className="space-y-1.5">
              <p
                className="text-xs font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                Type <strong>{user.email}</strong> to confirm
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={user.email}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none border"
                style={{
                  background: "var(--color-bg-input, rgba(255,255,255,0.06))",
                  borderColor: "var(--color-border-card)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          </div>
        }
        confirmLabel="Delete my account"
        confirmVariant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
