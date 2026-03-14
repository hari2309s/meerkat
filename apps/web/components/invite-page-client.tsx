"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GrainOverlay } from "@/components/grain-overlay";
import { createClient } from "@/lib/supabase/client";
import { startNavigationProgress } from "@/components/navigation-progress";
import { toast } from "sonner";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowRight,
  Home,
  UserPlus,
} from "lucide-react";
import { useRedeemKey } from "@meerkat/keys";
import { fromBase64 } from "@meerkat/crypto";
import { recoverInviteSecret } from "@/components/invite-auth-gate";

// ── Per-type copy ─────────────────────────────────────────────────────────────

const KEY_TYPE_CONFIG: Record<
  string,
  {
    emoji: string;
    label: string;
    description: string;
    joinCta: string;
  }
> = {
  "house-sit": {
    emoji: "🏠",
    label: "House-sit",
    description:
      "Full read & write access, even offline. You're a trusted member here.",
    joinCta: "Accept and enter den",
  },
  "come-over": {
    emoji: "👋",
    label: "Come Over",
    description:
      "Read and write together in real-time. Access ends when the session ends.",
    joinCta: "Join the session",
  },
  peek: {
    emoji: "👀",
    label: "Peek",
    description:
      "Read everything in this den. You won't be able to make changes — like being handed a notebook to read.",
    joinCta: "View the den",
  },
  letterbox: {
    emoji: "📬",
    label: "Letterbox",
    description:
      "Leave encrypted messages even when they're not online. They'll collect them next time they open their den.",
    joinCta: "Start dropping messages",
  },
};

const DEFAULT_CONFIG = KEY_TYPE_CONFIG["house-sit"];

// ── Shared card shell for status screens ─────────────────────────────────────

function Card({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  body,
  children,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
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
          style={{ background: iconBg }}
        >
          <Icon className="h-7 w-7" style={{ color: iconColor }} />
        </div>
        <h1
          className="text-xl font-bold mb-2"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h1>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {body}
        </p>
        {children}
      </motion.div>
    </div>
  );
}

type InviteStatus =
  | "valid"
  | "invalid"
  | "expired"
  | "already_used"
  | "already_member";

interface InvitePageClientProps {
  status: InviteStatus;
  token?: string;
  inviteId?: string;
  den?: { id: string; name: string; user_id: string };
  currentUserId?: string;
  /** Display name of the currently signed-in user — used for the one-tap accept screen (3.4). */
  currentUserName?: string;
  userEmail?: string;
  denId?: string;
  denName?: string;
  flowerPotToken?: string | null;
  keyType?: string;
  /** True for vault (v2 local-first) users — skips Supabase den_members insert. */
  isVaultUser?: boolean;
}

export function InvitePageClient({
  status,
  token,
  inviteId,
  den,
  currentUserId,
  currentUserName,
  denId,
  denName,
  flowerPotToken,
  keyType = "house-sit",
  isVaultUser = false,
}: InvitePageClientProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const { redeem } = useRedeemKey();

  const config = KEY_TYPE_CONFIG[keyType] ?? DEFAULT_CONFIG;

  const handleJoin = async () => {
    if (!den || !currentUserId || !inviteId || !token) {
      toast.error("Something went wrong", {
        description:
          "Could not load invite details. Please refresh the page and try again.",
      });
      return;
    }
    setJoining(true);
    try {
      if (!isVaultUser) {
        const supabase = createClient();

        // Insert into den_members
        const { error: memberErr } = await supabase
          .from("den_members")
          .insert({ den_id: den.id, user_id: currentUserId, role: "member" });
        if (memberErr && memberErr.code !== "23505") throw memberErr;

        // Mark invite as accepted
        await supabase
          .from("den_invites")
          .update({
            accepted_at: new Date().toISOString(),
            accepted_by: currentUserId,
          })
          .eq("id", inviteId);
      }

      // Redeem DenKey if a flower pot was attached to this invite.
      // The ephemeral secret key travels in the URL hash (#sk=...) and is
      // never sent to the server. If we came back from signup, it may be in
      // sessionStorage (saved by InviteAuthGate before redirect).
      if (flowerPotToken) {
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        let sk =
          new URLSearchParams(hash.slice(1)).get("sk") ??
          recoverInviteSecret(token);
        if (sk) {
          await redeem({
            token: flowerPotToken,
            visitorSecretKey: fromBase64(sk),
            fetchFromServer: async (t) => {
              const res = await fetch(
                `/api/flower-pots?token=${encodeURIComponent(t)}`,
              );
              return res.ok
                ? (res.json() as Promise<{ encryptedBundle: string }>)
                : null;
            },
          }).catch(() => {
            // Non-fatal — member can still access the den; host can re-issue a key
          });
        } else {
          toast.warning(
            "You joined, but real-time sync needs the full invite link.",
            {
              description:
                "Ask the owner to copy and send you the complete invite link (from the Copy button).",
            },
          );
        }
      }

      toast.success(`You've joined ${den.name}!`, {
        description: "Welcome to the den.",
      });
      startNavigationProgress();
      router.push(`/dens/${den.id}`);
    } catch (err: unknown) {
      toast.error("Failed to join", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
      setJoining(false);
    }
  };

  const goHome = () => {
    startNavigationProgress();
    router.push("/");
  };
  const goDen = () => {
    if (denId) {
      startNavigationProgress();
      router.push(`/dens/${denId}`);
    }
  };

  // ── Status screens ────────────────────────────────────────────────────────

  if (status === "invalid") {
    return (
      <Card
        icon={XCircle}
        iconBg="rgba(224,92,74,0.12)"
        iconColor="#e05c4a"
        title="Invalid invite"
        body="This invite link doesn't exist or has already been revoked. Ask the den owner to send you a fresh one."
      >
        <button
          onClick={goHome}
          className="btn-default w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Home className="h-4 w-4" />
          Go home
        </button>
      </Card>
    );
  }

  if (status === "expired") {
    return (
      <Card
        icon={Clock}
        iconBg="rgba(200,150,50,0.12)"
        iconColor="#c89632"
        title="Invite expired"
        body={`This invite link has expired. Invite links have a limited life to keep ${denName ? `${denName}` : "your den"} secure. Ask the den owner to send a fresh one — it only takes them a few seconds.`}
      >
        <button
          onClick={goHome}
          className="btn-default w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Home className="h-4 w-4" />
          Go home
        </button>
      </Card>
    );
  }

  if (status === "already_used") {
    return (
      <Card
        icon={CheckCircle2}
        iconBg="rgba(58,158,106,0.12)"
        iconColor="#3a9e6a"
        title="Already accepted"
        body="This invite link has already been used. Each link can only be accepted once."
      >
        {denId ? (
          <button
            onClick={goDen}
            className="btn-default w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            Open den
          </button>
        ) : (
          <button
            onClick={goHome}
            className="btn-default w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go home
          </button>
        )}
      </Card>
    );
  }

  if (status === "already_member") {
    return (
      <Card
        icon={CheckCircle2}
        iconBg="rgba(58,158,106,0.12)"
        iconColor="#3a9e6a"
        title="You're already in!"
        body={`You're already a member of ${denName ?? "this den"}.`}
      >
        <button
          onClick={goDen}
          className="btn-default w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
        >
          <ArrowRight className="h-4 w-4" />
          Open den
        </button>
      </Card>
    );
  }

  // ── Valid invite — join screen ─────────────────────────────────────────────

  return (
    <div className="min-h-screen page-bg flex items-center justify-center p-6">
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          backgroundSize: "150px",
        }}
      />
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
        {/* Den icon */}
        <div
          className="h-20 w-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(184,144,106,0.22) 0%, rgba(107,79,46,0.35) 100%)",
          }}
        >
          <Users
            className="h-8 w-8"
            style={{ color: "var(--color-avatar-bg)" }}
          />
        </div>

        {/* Wordmark */}
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--color-text-muted)" }}
        >
          You&apos;re invited to join
        </p>

        <h1
          className="text-2xl font-bold mb-3"
          style={{ color: "var(--color-text-primary)" }}
        >
          {den?.name}
        </h1>

        {/* Access type badge */}
        <div className="flex items-center justify-center mb-3">
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
        <p
          className="text-sm mb-5"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {config.description}
        </p>

        {/* Signed-in user context (3.4 — existing user one-tap flow) */}
        {currentUserName && (
          <p
            className="text-xs mb-5 rounded-xl px-4 py-2.5"
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border-card)",
              color: "var(--color-text-muted)",
            }}
          >
            <UserPlus className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            You&apos;re signed in as{" "}
            <span
              style={{ color: "var(--color-text-primary)", fontWeight: 600 }}
            >
              {currentUserName}
            </span>
            .
          </p>
        )}

        <motion.button
          onClick={handleJoin}
          disabled={joining}
          className="w-full rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          style={{
            background: "var(--color-btn-default-bg)",
            color: "var(--color-btn-default-text)",
            boxShadow: "0 4px 18px var(--color-btn-default-shadow)",
          }}
          whileHover={!joining ? { scale: 1.02, y: -1 } : {}}
          whileTap={!joining ? { scale: 0.97 } : {}}
        >
          {joining ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Joining…
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4" />
              {config.joinCta}
            </>
          )}
        </motion.button>

        <button
          onClick={goHome}
          className="mt-3 w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-60"
          style={{ color: "var(--color-text-muted)" }}
        >
          Maybe later
        </button>
      </motion.div>
    </div>
  );
}
