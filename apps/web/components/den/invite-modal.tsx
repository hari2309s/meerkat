"use client";

import { useState, useEffect } from "react";
import { UserPlus, Copy, Check, LinkIcon } from "lucide-react";
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
import { getSetting, setSetting } from "@meerkat/local-store";
import type { SerializedNamespaceKeySet } from "@meerkat/crypto";
import type { Den } from "@/types/den";
import {
  KEY_TYPE_OPTIONS,
  SENDER_GUIDANCE,
  DURATION_HINTS,
  DEFAULT_DURATION_MS,
  DURATION_OPTIONS,
} from "@/lib/invite-config";

interface InviteModalProps {
  den: Den;
  onClose: () => void;
  /** True for vault (v2 local-first) users — generates offline invite URL with no server calls. */
  isVaultUser?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildFlowerPot(
  denId: string,
  keyType: Exclude<KeyType, "custom">,
  durationMs: number | null,
): Promise<{ kp: KeyPair; flowerPotToken: string } | null> {
  try {
    const kp = generateKeyPair();
    // Reuse existing namespace keys if they exist — the host must always use the
    // same keys so they can decrypt drops encrypted with any invite's DenKey.
    const existingKeys = await getSetting<SerializedNamespaceKeySet>(
      denId,
      "den-ns-keys",
    );
    const allNamespaceKeys = existingKeys ?? (await generateDenNamespaceKeys());
    if (!existingKeys) {
      await setSetting(denId, "den-ns-keys", allNamespaceKeys);
    }
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

    // Track issued tokens so the host can revoke all of them during key rotation.
    const issuedTokens =
      (await getSetting<string[]>(denId, "issued-pot-tokens")) ?? [];
    await setSetting(denId, "issued-pot-tokens", [
      ...issuedTokens,
      flowerPotToken,
    ]);

    return { kp, flowerPotToken };
  } catch {
    return null;
  }
}

// ── Offline flower pot (vault users — no server) ──────────────────────────────
// Encodes the encrypted bundle directly as the "token" so it can be
// embedded in the URL hash. No Supabase call is made.

async function buildFlowerPotOffline(
  denId: string,
  keyType: Exclude<KeyType, "custom">,
  durationMs: number | null,
): Promise<{ kp: KeyPair; encryptedBundle: string } | null> {
  try {
    const kp = generateKeyPair();
    const existingKeys = await getSetting<SerializedNamespaceKeySet>(
      denId,
      "den-ns-keys",
    );
    const allNamespaceKeys = existingKeys ?? (await generateDenNamespaceKeys());
    if (!existingKeys) {
      await setSetting(denId, "den-ns-keys", allNamespaceKeys);
    }
    const denKey = generateKey({
      keyType,
      denId,
      allNamespaceKeys,
      ...(durationMs != null ? { durationMs } : {}),
    });
    // Use depositKey with an in-memory "server" — returns the bundle itself
    const encryptedBundle = await depositKey({
      key: denKey,
      visitorPublicKey: kp.publicKey,
      depositOnServer: async ({ encryptedBundle }) => encryptedBundle,
    });
    return { kp, encryptedBundle };
  } catch {
    return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function InviteModal({
  den,
  onClose,
  isVaultUser = false,
}: InviteModalProps) {
  // Key config state
  const [selectedKeyType, setSelectedKeyType] =
    useState<Exclude<KeyType, "custom">>("house-sit");
  const [selectedDurationMs, setSelectedDurationMs] = useState<number | null>(
    DEFAULT_DURATION_MS["house-sit"],
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
        if (isVaultUser) {
          // ── Vault user: fully offline, no server calls ──────────────────
          const result = await buildFlowerPotOffline(
            den.id,
            selectedKeyType,
            selectedDurationMs,
          );
          if (!result || cancelled) return;
          // Token = "vault" sentinel; bundle travels in the URL hash
          if (!cancelled) {
            setInviteToken("vault");
            setSecretKeyB64(
              `${toBase64(result.kp.secretKey)}&bundle=${encodeURIComponent(result.encryptedBundle)}&denId=${den.id}&denName=${encodeURIComponent(den.name)}&keyType=${selectedKeyType}`,
            );
          }
          return;
        }

        // ── Supabase user: server-backed flower pot ─────────────────────
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // 1. Build the flower pot first — this is what the invite link needs.
        //    Show the link immediately; den_invites creation is non-blocking.
        const result = await buildFlowerPot(
          den.id,
          selectedKeyType,
          selectedDurationMs,
        );
        if (!result || cancelled) return;

        const { kp, flowerPotToken } = result;

        // 2. Use the flower pot token directly as the invite URL token.
        //    The invite page falls back to a flower_pots lookup if no
        //    den_invites row is found, so this works even if step 3 fails.
        if (!cancelled) {
          setInviteToken(flowerPotToken);
          setSecretKeyB64(toBase64(kp.secretKey));
        }

        // 3. Create the den_invites row in the background (non-blocking).
        //    Failure here is non-fatal — the link already works via the flower pot.
        const expiresAt = selectedDurationMs
          ? new Date(Date.now() + selectedDurationMs).toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        supabase
          .from("den_invites")
          .insert({
            den_id: den.id,
            invited_by: user.id,
            key_type: selectedKeyType,
            flower_pot_token: flowerPotToken,
            expires_at: expiresAt,
          })
          .then(({ error }) => {
            if (error)
              console.warn(
                "[invite-modal] den_invites insert failed (non-fatal):",
                error.message,
              );
          });
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
  }, [den.id, den.name, selectedKeyType, selectedDurationMs, isVaultUser]);

  // The shareable link includes the flower-pot secret in the hash fragment
  // so the server never sees it.
  // Supabase: /invite/TOKEN#sk=SECRET_BASE64
  // Vault:    /invite/vault#sk=SECRET&bundle=BUNDLE&denId=ID&denName=NAME&keyType=TYPE
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteLink =
    inviteToken && secretKeyB64
      ? `${origin}/invite/${inviteToken}#sk=${secretKeyB64}`
      : inviteToken
        ? `${origin}/invite/${inviteToken}`
        : null;
  // For vault invites the full link (including hash) is what matters — show it.
  // For Supabase invites keep the shorter display (secret stays in hash, not shown).
  const displayLink = isVaultUser
    ? inviteLink
    : inviteToken
      ? `${origin}/invite/${inviteToken}`
      : null;

  const selectedDurationLabel =
    DURATION_OPTIONS.find((d) => d.durationMs === selectedDurationMs)?.label ??
    "No expiry";

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    const opt = KEY_TYPE_OPTIONS.find((o) => o.value === selectedKeyType);
    toast.success("Invite link copied!", {
      description: `They'll see a welcome screen explaining ${opt?.emoji ?? ""} ${opt?.label ?? selectedKeyType} access, then a guided Key setup. They'll land directly in ${den.name}. 🦦`,
      duration: 6000,
    });
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
      <div className="grid grid-cols-2 gap-2 mb-2">
        {KEY_TYPE_OPTIONS.map((opt) => {
          const active = selectedKeyType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                setSelectedKeyType(opt.value);
                setSelectedDurationMs(DEFAULT_DURATION_MS[opt.value]);
              }}
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

      {/* Sender guidance for selected type */}
      {SENDER_GUIDANCE[selectedKeyType] && (
        <p
          className="text-xs leading-relaxed mb-4 px-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          {SENDER_GUIDANCE[selectedKeyType]}
        </p>
      )}

      {/* ── Duration selector ─────────────────────────────────────────────── */}
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: "var(--color-text-muted)" }}
      >
        Key duration
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
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

      {/* Duration hint — explains the auto-preselected choice */}
      {DURATION_HINTS[selectedKeyType] && (
        <p
          className="text-xs leading-relaxed mb-5 px-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          {DURATION_HINTS[selectedKeyType]}
        </p>
      )}

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
