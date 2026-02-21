"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  LogOut,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  Trash2,
} from "lucide-react";
import { SectionCard, ConfirmModal } from "@/components/settings/shared";
import type { SessionInfo, SettingsUser } from "@/components/settings/types";

// ── Password card ─────────────────────────────────────────────────────────────

function PasswordCard({ email }: { email: string }) {
  const handleChangePassword = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent", {
        description: `Check ${email} for the password reset link.`,
      });
    } catch (err: unknown) {
      toast.error("Failed to send reset link", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  };

  return (
    <SectionCard title="Password" subtitle="Manage your account password">
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
            We&apos;ll send a reset link to {email}
          </p>
        </div>
        <Button variant="outline" onClick={handleChangePassword}>
          Send reset link
        </Button>
      </div>
    </SectionCard>
  );
}

// ── Sessions card ─────────────────────────────────────────────────────────────

function SessionsCard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/sessions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessions(data.sessions ?? []);
    } catch {
      toast.error("Could not load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async (id: string) => {
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

  return (
    <>
      <SectionCard title="Sessions" subtitle="Manage where you're signed in">
        {loading ? (
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
                  : s.device === "iPad" || s.device === "Android Tablet"
                    ? Tablet
                    : Monitor;

              const diffMin = Math.floor(
                (Date.now() - new Date(s.lastActiveAt).getTime()) / 60000,
              );
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
                      onClick={() => handleRevoke(s.id)}
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
              onClick={() => setSignOutAllOpen(true)}
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

      <ConfirmModal
        open={signOutAllOpen}
        onClose={() => !isSigningOut && setSignOutAllOpen(false)}
        onConfirm={handleSignOutAll}
        title="Sign out everywhere?"
        body="This will sign you out of Meerkat on all your devices, including this one. You will need to sign in again everywhere."
        confirmLabel="Sign out all"
        confirmVariant="danger"
        loading={isSigningOut}
      />
    </>
  );
}

// ── Danger Zone card ──────────────────────────────────────────────────────────

function DangerZoneCard({ email }: { email: string }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Deletion failed");
      }
      toast.success("Account deleted");
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

  return (
    <>
      <SectionCard title="Danger Zone" subtitle="Irreversible actions">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "#c0392b" }}>
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
              setConfirmText("");
              setDeleteOpen(true);
            }}
          >
            Delete account
          </Button>
        </div>
      </SectionCard>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => !isDeleting && setDeleteOpen(false)}
        onConfirm={handleDelete}
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
                Type <strong>{email}</strong> to confirm
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={email}
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
    </>
  );
}

// ── SecuritySection (exported) ────────────────────────────────────────────────

export function SecuritySection({ user }: { user: SettingsUser }) {
  return (
    <>
      <PasswordCard email={user.email} />
      <SessionsCard />
      <DangerZoneCard email={user.email} />
    </>
  );
}
