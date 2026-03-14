"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { GrainOverlay } from "@/components/grain-overlay";
import { persistInviteSecret } from "@/components/invite-auth-gate";

// ── Per-type copy ─────────────────────────────────────────────────────────────

const KEY_TYPE_CONFIG: Record<
  string,
  { emoji: string; label: string; description: string; cta: string }
> = {
  "house-sit": {
    emoji: "🏠",
    label: "House-sit",
    description:
      "Full read & write access, even offline. You're a trusted member here.",
    cta: "Set up your Key and enter",
  },
  "come-over": {
    emoji: "👋",
    label: "Come Over",
    description:
      "Read and write together in real-time. Access ends when the session ends.",
    cta: "Join the session",
  },
  peek: {
    emoji: "👀",
    label: "Peek",
    description:
      "Read everything in this den, but you won't be able to make changes. Like being handed a notebook to read.",
    cta: "View the den",
  },
  letterbox: {
    emoji: "📬",
    label: "Letterbox",
    description:
      "Leave encrypted messages even when they're not online. They'll collect them next time they open their den.",
    cta: "Set up your Key and start dropping",
  },
};

const DEFAULT_CONFIG = KEY_TYPE_CONFIG["house-sit"];

// ── Component ─────────────────────────────────────────────────────────────────

interface InviteLandingPageProps {
  token: string;
  denName: string;
  keyType?: string;
}

export function InviteLandingPage({
  token,
  denName,
  keyType = "house-sit",
}: InviteLandingPageProps) {
  const router = useRouter();
  const config = KEY_TYPE_CONFIG[keyType] ?? DEFAULT_CONFIG;

  // Pre-save the #sk= hash on mount so it survives the signup redirect.
  useEffect(() => {
    persistInviteSecret(token);
  }, [token]);

  const handleAccept = () => {
    // Save the secret one more time in case useEffect hasn't fired yet
    // (e.g. very fast tap on a slow device).
    persistInviteSecret(token);
    router.push(
      `/v2/signup?next=${encodeURIComponent(`/invite/${token}`)}&denName=${encodeURIComponent(denName)}`,
    );
  };

  return (
    <div className="min-h-screen page-bg flex items-center justify-center p-6">
      <GrainOverlay />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative w-full max-w-sm rounded-2xl p-8 text-center space-y-6"
        style={{
          background: "var(--color-bg-card)",
          border: "1.5px solid var(--color-border-card)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.16)",
        }}
      >
        {/* Meerkat wordmark */}
        <div className="space-y-1">
          <p
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Meerkat
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            A private space for your people
          </p>
        </div>

        {/* Den name + invite message */}
        <div className="space-y-3">
          <p
            className="text-base font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            You&apos;ve been invited to{" "}
            <span style={{ color: "hsl(var(--meerkat-brown))" }}>
              {denName}
            </span>
            .
          </p>

          {/* Access type badge */}
          <div className="flex items-center justify-center">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{
                background: "var(--color-selection-active-bg)",
                color: "var(--color-selection-active-text)",
                border: "1px solid var(--color-selection-active-border)",
              }}
            >
              <span>{config.emoji}</span>
              <span>{config.label}</span>
            </div>
          </div>

          {/* Per-type description */}
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {config.description}
          </p>

          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No ads. No data harvesting. Yours forever.
          </p>
        </div>

        {/* CTA */}
        <motion.button
          onClick={handleAccept}
          className="w-full rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2"
          style={{
            background: "var(--color-btn-default-bg)",
            color: "var(--color-btn-default-text)",
            boxShadow: "0 4px 18px var(--color-btn-default-shadow)",
          }}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.97 }}
        >
          {config.cta}
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </motion.div>
    </div>
  );
}
