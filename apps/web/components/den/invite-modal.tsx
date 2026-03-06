"use client";

import { useState, useEffect } from "react";
import { UserPlus, Loader2, Send, Copy, Check, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ModalShell } from "@meerkat/ui";
import { HoverButton } from "@meerkat/ui";
import { generateKeyPair, toBase64, type KeyPair } from "@meerkat/crypto";
import {
  generateKey,
  depositKey,
  generateDenNamespaceKeys,
} from "@meerkat/keys";
import type { KeyType } from "@meerkat/keys";
import type { Den } from "@/types/den";

interface InviteModalProps {
  den: Den;
  onClose: () => void;
}

// ── Key type options ─────────────────────────────────────────────────────────

const KEY_TYPE_OPTIONS: {
  value: Exclude<KeyType, "custom">;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    value: "house-sit",
    label: "House-sit",
    description: "Full access, offline capable. Best for trusted members.",
    emoji: "🏠",
  },
  {
    value: "come-over",
    label: "Come Over",
    description: "Real-time read & write. Live sessions only.",
    emoji: "👋",
  },
  {
    value: "peek",
    label: "Peek",
    description: "Read-only access to shared notes. No changes.",
    emoji: "👀",
  },
  {
    value: "letterbox",
    label: "Letterbox",
    description: "Drop messages when you're not home. Works offline.",
    emoji: "📬",
  },
];

// ── Duration options ─────────────────────────────────────────────────────────

const DURATION_OPTIONS: { label: string; durationMs: number | null }[] = [
  { label: "7 days", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 days", durationMs: 30 * 24 * 60 * 60 * 1000 },
  { label: "90 days", durationMs: 90 * 24 * 60 * 60 * 1000 },
  { label: "1 year", durationMs: 365 * 24 * 60 * 60 * 1000 },
  { label: "No expiry", durationMs: null },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildFlowerPot(
  denId: string,
  keyType: Exclude<KeyType, "custom">,
  durationMs: number | null,
): Promise<{ kp: KeyPair; flowerPotToken: string } | null> {
  try {
    const kp = generateKeyPair();
    const allNamespaceKeys = await generateDenNamespaceKeys();
    const denKey = generateKey({
      keyType,
      denId,
      allNamespaceKeys,
      ...(durationMs != null ? { durationMs } : {}),
    });
    const flowerPotToken = await depositKey({
      key: denKey,
      visitorPublicKey: kp.publicKey,
      depositOnServer: async ({ denId, encryptedBundle, expiresAt }) => {
        const res = await fetch("/api/flower-pots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ denId, encryptedBundle, expiresAt }),
        });
        if (!res.ok) throw new Error("Failed to deposit flower pot");
        const json = (await res.json()) as { token: string };
        return json.token;
      },
    });
    return { kp, flowerPotToken };
  } catch {
    return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function InviteModal({ den, onClose }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Key config state
  const [selectedKeyType, setSelectedKeyType] =
    useState<Exclude<KeyType, "custom">>("house-sit");
  const [selectedDurationMs, setSelectedDurationMs] = useState<number | null>(
    30 * 24 * 60 * 60 * 1000,
  );

  // Link state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [secretKeyB64, setSecretKeyB64] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reusable link generation — re-runs when key type or duration changes
  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      setGeneratingLink(true);
      setInviteToken(null);
      setSecretKeyB64(null);

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // 1. Create the membership invite row
        const { data: inviteData, error: inviteErr } = await supabase
          .from("den_invites")
          .insert({ den_id: den.id, invited_by: user.id })
          .select("id, token")
          .single();
        if (inviteErr || !inviteData || cancelled) return;

        setInviteToken(inviteData.token);

        // 2. Build the flower pot
        const result = await buildFlowerPot(
          den.id,
          selectedKeyType,
          selectedDurationMs,
        );
        if (!result || cancelled) return;

        const { kp, flowerPotToken } = result;

        // 3. Link the flower pot back to the invite row
        await supabase
          .from("den_invites")
          .update({ flower_pot_token: flowerPotToken })
          .eq("id", inviteData.id);

        if (!cancelled) {
          setSecretKeyB64(toBase64(kp.secretKey));
        }
      } catch (err) {
        console.warn("[invite-modal] Failed to generate flower pot:", err);
      } finally {
        if (!cancelled) setGeneratingLink(false);
      }
    };
    generate();
    return () => {
      cancelled = true;
    };
  }, [den.id, selectedKeyType, selectedDurationMs]);

  // The shareable link includes the flower-pot secret in the hash fragment
  // so the server never sees it.  Format: /invite/TOKEN#sk=SECRET_BASE64
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteLink =
    inviteToken && secretKeyB64
      ? `${origin}/invite/${inviteToken}#sk=${secretKeyB64}`
      : inviteToken
        ? `${origin}/invite/${inviteToken}`
        : null;
  const displayLink = inviteToken ? `${origin}/invite/${inviteToken}` : null;

  const selectedDurationLabel =
    DURATION_OPTIONS.find((d) => d.durationMs === selectedDurationMs)?.label ??
    "No expiry";

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

      const { data: inviteData } = await supabase
        .from("den_invites")
        .insert({ den_id: den.id, invited_by: user.id, email: trimmed })
        .select("id, token")
        .single();

      if (inviteData) {
        const result = await buildFlowerPot(
          den.id,
          selectedKeyType,
          selectedDurationMs,
        );
        if (result) {
          const { kp, flowerPotToken } = result;
          await supabase
            .from("den_invites")
            .update({ flower_pot_token: flowerPotToken })
            .eq("id", inviteData.id);

          const sk = toBase64(kp.secretKey);
          const emailLink = `${window.location.origin}/invite/${inviteData.token}#sk=${sk}`;
          await navigator.clipboard.writeText(emailLink);
          toast.success(`Invite link for ${trimmed} copied!`, {
            description: "Paste it in an email or message to them.",
          });
        } else {
          toast.success(`Invite created for ${trimmed}`, {
            description: "They'll receive a link to join.",
          });
        }
      } else {
        toast.success(`Invite sent to ${trimmed}`, {
          description: "They'll receive a link to join.",
        });
      }
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
    <ModalShell
      onClose={onClose}
      maxWidth="max-w-md"
      cardStyle={{ background: "var(--color-modal-bg)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--color-selection-active-bg)" }}
        >
          <UserPlus
            className="h-4 w-4"
            style={{ color: "var(--color-selection-active-text)" }}
          />
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
            Choose access level and duration below
          </p>
        </div>
      </div>

      {/* ── Key type selector ─────────────────────────────────────────────── */}
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: "var(--color-text-muted)" }}
      >
        Access type
      </p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {KEY_TYPE_OPTIONS.map((opt) => {
          const active = selectedKeyType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setSelectedKeyType(opt.value)}
              className="text-left rounded-xl px-3 py-2.5 transition-all"
              style={{
                background: active
                  ? "var(--color-selection-active-bg)"
                  : "var(--color-input-bg)",
                border: active
                  ? "1.5px solid var(--color-selection-active-border)"
                  : "1.5px solid var(--color-input-border)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-base leading-none">{opt.emoji}</span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: active
                      ? "var(--color-selection-active-text)"
                      : "var(--color-text-primary)",
                  }}
                >
                  {opt.label}
                </span>
              </div>
              <p
                className="text-xs leading-snug"
                style={{ color: "var(--color-text-muted)" }}
              >
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Duration selector ─────────────────────────────────────────────── */}
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: "var(--color-text-muted)" }}
      >
        Key duration
      </p>
      <div className="flex flex-wrap gap-2 mb-5">
        {DURATION_OPTIONS.map((opt) => {
          const active = selectedDurationMs === opt.durationMs;
          return (
            <button
              key={opt.label}
              onClick={() => setSelectedDurationMs(opt.durationMs)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active
                  ? "var(--color-selection-active-bg)"
                  : "var(--color-input-bg)",
                border: active
                  ? "1.5px solid var(--color-selection-active-border)"
                  : "1.5px solid var(--color-input-border)",
                color: active
                  ? "var(--color-selection-active-text)"
                  : "var(--color-text-secondary)",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* ── Invite by email ───────────────────────────────────────────────── */}
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

      {/* ── Link preview ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-1"
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
            {displayLink ?? "—"}
          </span>
        )}
      </div>
      <p
        className="text-xs mb-3 px-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        {selectedKeyType === "house-sit" && "🏠 House-sit"}
        {selectedKeyType === "come-over" && "👋 Come Over"}
        {selectedKeyType === "peek" && "👀 Peek"}
        {selectedKeyType === "letterbox" && "📬 Letterbox"}
        {" · "}
        {selectedDurationLabel === "No expiry"
          ? "Never expires"
          : `Expires in ${selectedDurationLabel}`}
      </p>
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
