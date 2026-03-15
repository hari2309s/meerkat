"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/top-nav";
import { GrainOverlay } from "@/components/grain-overlay";
import { User, Shield, Inbox, KeyRound } from "lucide-react";
import { ProfileSection } from "@/components/settings/profile-section";
import { SecuritySection } from "@/components/settings/security-section";
import { DropboxSection } from "@/components/settings/dropbox-section";
import { VaultKeySection } from "@/components/settings/vault-key-section";
import type { Section, SettingsUser } from "@/components/settings/types";

interface SettingsPageClientProps {
  user: SettingsUser;
}

const ALL_NAV_ITEMS: {
  id: Section;
  label: string;
  icon: React.ElementType;
  vaultOnly?: boolean;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "vault", label: "Vault Key", icon: KeyRound, vaultOnly: true },
  { id: "dropbox", label: "Dropbox", icon: Inbox },
];

export function SettingsPageClient({ user }: SettingsPageClientProps) {
  const isVault = user.id === "vault";
  const NAV_ITEMS = ALL_NAV_ITEMS.filter((item) => !item.vaultOnly || isVault);
  const [activeSection, setActiveSection] = useState<Section>("profile");

  return (
    <div className="min-h-screen page-bg">
      <GrainOverlay />

      <TopNav
        user={{
          name: user.name,
          preferredName: user.preferredName,
          email: user.email,
        }}
      />

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
                background: "var(--color-bg-sidebar)",
                backdropFilter: "blur(20px) saturate(1.5)",
                WebkitBackdropFilter: "blur(20px) saturate(1.5)",
                border: "1.5px solid var(--color-border-nav)",
                boxShadow: "0 4px 24px rgba(90,55,20,0.07)",
              }}
            >
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`settings-nav-item ${active ? "settings-nav-active" : ""} w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150 my-2`}
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

          {/* Content */}
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col gap-4"
          >
            {activeSection === "profile" && <ProfileSection user={user} />}
            {activeSection === "security" && <SecuritySection user={user} />}
            {activeSection === "vault" && <VaultKeySection />}
            {activeSection === "dropbox" && <DropboxSection userId={user.id} />}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
