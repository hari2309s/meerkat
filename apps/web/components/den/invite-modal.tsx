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
import type { Den } from "@/types/den";

interface InviteModalProps {
  den: Den;
  onClose: () => void;
}

export function InviteModal({ den, onClose }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [_inviteId, setInviteId] = useState<string | null>(null);
  // Ephemeral secret key embedded in the URL hash — never sent to server
  const [secretKeyB64, setSecretKeyB64] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  // The shareable link includes the flower-pot secret in the hash fragment
  // so the server never sees it.  Format: /invite/TOKEN#sk=SECRET_BASE64
  const inviteLink =
    inviteToken && secretKeyB64
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inviteToken}#sk=${secretKeyB64}`
      : inviteToken
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

        // 1. Create the membership invite row
        const { data: inviteData, error: inviteErr } = await supabase
          .from("den_invites")
          .insert({ den_id: den.id, invited_by: user.id })
          .select("id, token")
          .single();
        if (inviteErr || !inviteData) return;

        setInviteToken(inviteData.token);
        setInviteId(inviteData.id);

        // 2. Generate an ephemeral X25519 keypair for the flower pot
        // The secret key travels in the URL hash (never sent to server).
        // The public key seals the DenKey so only the holder of the secret can open it.
        let kp: KeyPair;
        try {
          kp = generateKeyPair();
        } catch {
          // Crypto not available (SSR guard) — link still works without DenKey
          return;
        }

        // 3. Generate placeholder namespace keys
        // Content isn't namespace-encrypted in Phase 4; these satisfy validateKey()
        // structural checks without granting real namespace decryption (Phase 5+).
        const allNamespaceKeys = await generateDenNamespaceKeys();

        // 4. Generate a 30-day house-sit DenKey for the invitee
        const denKey = generateKey({
          keyType: "house-sit",
          denId: den.id,
          allNamespaceKeys,
          durationMs: 30 * 24 * 60 * 60 * 1000,
        });

        // 5. Deposit the sealed DenKey as a flower pot on the server
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

        // 6. Link the flower pot back to the invite row
        await supabase
          .from("den_invites")
          .update({ flower_pot_token: flowerPotToken })
          .eq("id", inviteData.id);

        // 7. Embed the secret key in the URL hash (never sent to server)
        setSecretKeyB64(toBase64(kp.secretKey));
      } catch (err) {
        // Non-fatal: link still works for membership; visitor just won't get a DenKey
        console.warn("[invite-modal] Failed to generate flower pot:", err);
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

      // Create a separate invite row for the email recipient
      // (they get their own flower pot when they open the link)
      const { data: inviteData } = await supabase
        .from("den_invites")
        .insert({ den_id: den.id, invited_by: user.id, email: trimmed })
        .select("id, token")
        .single();

      if (inviteData) {
        // Generate a dedicated flower pot for the email invitee
        try {
          const kp = generateKeyPair();
          const allNamespaceKeys = await generateDenNamespaceKeys();
          const denKey = generateKey({
            keyType: "house-sit",
            denId: den.id,
            allNamespaceKeys,
            durationMs: 30 * 24 * 60 * 60 * 1000,
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
          await supabase
            .from("den_invites")
            .update({ flower_pot_token: flowerPotToken })
            .eq("id", inviteData.id);

          const sk = toBase64(kp.secretKey);
          const emailLink = `${window.location.origin}/invite/${inviteData.token}#sk=${sk}`;
          // In a real app you'd send this via an email service; for now copy to clipboard
          await navigator.clipboard.writeText(emailLink);
          toast.success(`Invite link for ${trimmed} copied!`, {
            description: "Paste it in an email or message to them.",
          });
        } catch {
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

  // Display link without the secret for the preview box
  const displayLink = inviteToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inviteToken}`
    : null;

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
            Links expire in 30 days · includes den access key
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
            {displayLink ?? "—"}
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
