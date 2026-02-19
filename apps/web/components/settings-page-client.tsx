"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TopNav } from "@/components/top-nav";
import { Button } from "@meerkat/ui";
import { Input } from "@meerkat/ui";
import { Label } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Bell,
  Shield,
  Palette,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react";

interface SettingsPageClientProps {
  user: {
    id: string;
    name: string;
    preferredName: string;
    email: string;
  };
}

type Section = "profile" | "notifications" | "appearance" | "security";

const sections = [
  { id: "profile" as Section, label: "Profile", icon: User },
  { id: "notifications" as Section, label: "Notifications", icon: Bell },
  { id: "appearance" as Section, label: "Appearance", icon: Palette },
  { id: "security" as Section, label: "Security", icon: Shield },
];

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
        background: "rgba(255,248,240,0.55)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        border: "1.5px solid rgba(255,255,255,0.5)",
        boxShadow:
          "0 4px 24px rgba(90,55,20,0.07), 0 1px 0 rgba(255,255,255,0.6) inset",
      }}
    >
      <div className="mb-5">
        <h3 className="text-base font-semibold" style={{ color: "#3a2718" }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: "#7a5535" }}>
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
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: checked ? "#8B6F47" : "rgba(139,111,71,0.2)" }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(26px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export function SettingsPageClient({ user }: SettingsPageClientProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [isSaving, setIsSaving] = useState(false);

  // Profile form — initialised from server-fetched user
  const [name, setName] = useState(user.name);
  const [preferredName, setPreferredName] = useState(user.preferredName);

  // Notification prefs
  const [notifs, setNotifs] = useState({
    emailActivity: true,
    emailDigest: false,
    pushMessages: true,
    pushMentions: true,
  });

  // Appearance
  const [theme, setTheme] = useState<"light" | "system">("light");

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: name,
          preferred_name: preferredName.trim() || name,
        },
      });

      if (error) throw error;

      // Refresh the server component so the nav + any server-read values update
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
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    toast.success("Notification preferences saved");
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

  // Derive avatar initials from current preferredName or name
  const avatarInitials = (preferredName || name)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(135deg, #f5e6d3 0%, #e8d0b0 40%, #d4a574 100%)",
      }}
    >
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
          <h1 className="text-3xl font-bold" style={{ color: "#3a2718" }}>
            Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: "#7a5535" }}>
            Manage your account and preferences
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Sidebar */}
          <motion.aside
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="sm:w-48 shrink-0"
          >
            <div
              className="rounded-2xl p-1.5"
              style={{
                background: "rgba(255,248,240,0.45)",
                backdropFilter: "blur(20px) saturate(1.5)",
                WebkitBackdropFilter: "blur(20px) saturate(1.5)",
                border: "1.5px solid rgba(255,255,255,0.45)",
                boxShadow: "0 4px 24px rgba(90,55,20,0.07)",
              }}
            >
              {sections.map(({ id, label, icon: Icon }) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left"
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.6)"
                        : "transparent",
                      color: active ? "#3a2718" : "#7a5535",
                      boxShadow: active
                        ? "0 1px 4px rgba(90,55,20,0.08)"
                        : "none",
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                    {active && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </motion.aside>

          {/* Content */}
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-1 space-y-4"
          >
            {/* ── PROFILE ── */}
            {activeSection === "profile" && (
              <>
                <SectionCard
                  title="Personal Information"
                  subtitle="Update your name and how we greet you"
                >
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="full-name">Full Name</Label>
                      <Input
                        id="full-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Meera Kat"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="preferred-name">Preferred Name</Label>
                        <span className="text-xs" style={{ color: "#9a7a55" }}>
                          (optional)
                        </span>
                      </div>
                      <Input
                        id="preferred-name"
                        value={preferredName}
                        onChange={(e) => setPreferredName(e.target.value)}
                        placeholder="What should we call you?"
                      />
                      <p className="text-xs" style={{ color: "#9a7a55" }}>
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
                      <p className="text-xs" style={{ color: "#9a7a55" }}>
                        Email cannot be changed here
                      </p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="min-w-[120px]"
                      >
                        {isSaving ? (
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
                      className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
                      style={{ background: "#8B6F47" }}
                    >
                      {avatarInitials}
                    </div>
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "#3a2718" }}
                      >
                        {preferredName || name}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "#7a5535" }}
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
                      desc: "Messages and replies in your workspaces",
                    },
                    {
                      key: "emailDigest",
                      label: "Email — Weekly digest",
                      desc: "A summary of activity across your spaces",
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
                      className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "#3a2718" }}
                        >
                          {label}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "#7a5535" }}
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
                    className="min-w-[120px]"
                  >
                    Save preferences
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
                <div className="grid grid-cols-2 gap-3">
                  {(["light", "system"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className="relative rounded-xl p-4 text-left transition-all border-2"
                      style={{
                        background:
                          t === "light"
                            ? "rgba(255,248,240,0.8)"
                            : "rgba(58,39,24,0.08)",
                        borderColor:
                          theme === t ? "#8B6F47" : "rgba(255,255,255,0.3)",
                      }}
                    >
                      <div
                        className="h-10 rounded-lg mb-3"
                        style={{
                          background:
                            t === "light"
                              ? "linear-gradient(135deg, #f5e6d3, #d4a574)"
                              : "linear-gradient(135deg, #2a1a0e, #4a2e14)",
                        }}
                      />
                      <p
                        className="text-sm font-medium capitalize"
                        style={{ color: "#3a2718" }}
                      >
                        {t === "system" ? "System" : "Light"}
                      </p>
                      {theme === t && (
                        <div
                          className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full flex items-center justify-center"
                          style={{ background: "#8B6F47" }}
                        >
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ── SECURITY ── */}
            {activeSection === "security" && (
              <>
                <SectionCard
                  title="Password"
                  subtitle="Manage your account password"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "#3a2718" }}
                      >
                        Change password
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "#7a5535" }}
                      >
                        We'll send a reset link to {user.email}
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleChangePassword}>
                      Send reset link
                    </Button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Sessions"
                  subtitle="Manage where you're signed in"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "#3a2718" }}
                      >
                        Current session
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "#7a5535" }}
                      >
                        This browser — active now
                      </p>
                    </div>
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: "rgba(34,197,94,0.12)",
                        color: "#16a34a",
                      }}
                    >
                      Active
                    </span>
                  </div>
                </SectionCard>

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
                        style={{ color: "#7a5535" }}
                      >
                        Permanently delete your account and all data
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
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
    </div>
  );
}
