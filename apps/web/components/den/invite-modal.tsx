"use client";

import { useState, useEffect } from "react";
import { UserPlus, Loader2, Send, Copy, Check, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ModalShell } from "@/components/ui/modal-shell";
import { HoverButton } from "@/components/ui/hover-button";
import type { Den } from "@/types/den";

interface InviteModalProps {
  den: Den;
  onClose: () => void;
}

export function InviteModal({ den, onClose }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteLink = inviteToken
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
        const { data, error } = await supabase
          .from("den_invites")
          .insert({ den_id: den.id, invited_by: user.id })
          .select("token")
          .single();
        if (!error && data) setInviteToken(data.token);
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
      await supabase
        .from("den_invites")
        .insert({ den_id: den.id, invited_by: user.id, email: trimmed });
      toast.success(`Invite sent to ${trimmed}`, {
        description: "They'll receive a link to join.",
      });
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
            Links expire in 7 days
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
            {inviteLink ?? "—"}
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
