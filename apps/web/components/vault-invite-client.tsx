"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { GrainOverlay } from "@/components/grain-overlay";
import { useRedeemKey } from "@meerkat/keys";
import { fromBase64 } from "@meerkat/crypto";
import { startNavigationProgress } from "@/components/navigation-progress";
import { toast } from "sonner";

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
    cta: "Accept and enter den",
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
      "Read everything in this den. Like being handed a notebook — no changes.",
    cta: "View the den",
  },
  letterbox: {
    emoji: "📬",
    label: "Letterbox",
    description:
      "Leave encrypted messages even when they're not online. They'll collect them next time.",
    cta: "Start dropping messages",
  },
};

const DEFAULT_CONFIG = KEY_TYPE_CONFIG["house-sit"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface HashParams {
  sk: string | null;
  bundle: string | null;
  denId: string | null;
  denName: string | null;
  keyType: string | null;
}

function parseVaultHash(): HashParams {
  if (typeof window === "undefined") {
    return {
      sk: null,
      bundle: null,
      denId: null,
      denName: null,
      keyType: null,
    };
  }
  const hash = window.location.hash.slice(1); // strip leading #
  const p = new URLSearchParams(hash);
  return {
    sk: p.get("sk"),
    bundle: p.get("bundle"),
    denId: p.get("denId"),
    denName: p.get("denName"),
    keyType: p.get("keyType"),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VaultInviteClient() {
  const router = useRouter();
  const { redeem } = useRedeemKey();

  const [params, setParams] = useState<HashParams>({
    sk: null,
    bundle: null,
    denId: null,
    denName: null,
    keyType: null,
  });
  const [accepting, setAccepting] = useState(false);

  // Read hash on mount (hash is client-only)
  useEffect(() => {
    setParams(parseVaultHash());
  }, []);

  const { sk, bundle, denId, denName, keyType } = params;
  const config = KEY_TYPE_CONFIG[keyType ?? ""] ?? DEFAULT_CONFIG;
  const isValid = !!(sk && bundle && denId);

  const handleAccept = async () => {
    if (!sk || !bundle || !denId) return;
    setAccepting(true);
    try {
      await redeem({
        // The bundle IS the token — fetchFromServer returns it directly
        token: bundle,
        visitorSecretKey: fromBase64(sk),
        fetchFromServer: async (t) => ({ encryptedBundle: t }),
      });
      toast.success(`Joined ${denName ?? "the den"}!`, {
        description: "Welcome.",
      });
      startNavigationProgress();
      router.push(`/dens/${denId}`);
    } catch (err) {
      toast.error("Couldn't accept invite", {
        description:
          err instanceof Error
            ? err.message
            : "The invite link may be invalid or corrupted.",
      });
      setAccepting(false);
    }
  };

  const goHome = () => {
    startNavigationProgress();
    router.push("/");
  };

  if (!isValid && params.sk !== null) {
    // Hash was parsed but required fields are missing — invalid link
    return (
      <div className="min-h-screen page-bg flex items-center justify-center p-6">
        <GrainOverlay />
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative w-full max-w-sm rounded-2xl p-8 text-center"
          style={{
            background: "var(--color-bg-card)",
            border: "1.5px solid var(--color-border-card)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.16)",
          }}
        >
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(224,92,74,0.12)" }}
          >
            <AlertTriangle className="h-7 w-7" style={{ color: "#e05c4a" }} />
          </div>
          <h1
            className="text-xl font-bold mb-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            Invalid invite
          </h1>
          <p
            className="text-sm leading-relaxed mb-6"
            style={{ color: "var(--color-text-secondary)" }}
          >
            This invite link is missing required data. Make sure you copied the
            full link, including everything after the # symbol.
          </p>
          <button
            onClick={goHome}
            className="btn-default w-full rounded-xl py-3 text-sm font-semibold"
          >
            Go home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg flex items-center justify-center p-6">
      <GrainOverlay />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative w-full max-w-sm rounded-2xl p-8 text-center space-y-5"
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

        {/* Den name */}
        <div className="space-y-3">
          <p
            className="text-base font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            You&apos;ve been invited to{" "}
            <span style={{ color: "hsl(var(--meerkat-brown))" }}>
              {denName ?? "a den"}
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
          disabled={accepting || !isValid}
          className="w-full rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          style={{
            background: "var(--color-btn-default-bg)",
            color: "var(--color-btn-default-text)",
            boxShadow: "0 4px 18px var(--color-btn-default-shadow)",
          }}
          whileHover={!accepting && isValid ? { scale: 1.02, y: -1 } : {}}
          whileTap={!accepting && isValid ? { scale: 0.97 } : {}}
        >
          {accepting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining…
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4" />
              {config.cta}
            </>
          )}
        </motion.button>

        <button
          onClick={goHome}
          className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-60"
          style={{ color: "var(--color-text-muted)" }}
        >
          Maybe later
        </button>
      </motion.div>
    </div>
  );
}
