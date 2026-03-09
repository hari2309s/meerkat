"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@meerkat/ui";
import { SectionCard } from "@/components/settings/shared";
import { loadMnemonic, loadProfile } from "@/lib/vault-credentials";

// ---------------------------------------------------------------------------
// VaultKeySection
//
// Lets vault (v2) users recover their 12-word mnemonic phrase on the current
// device. The phrase is read from localStorage — it was saved there during
// signup / login and is never sent to any server.
//
// Design decisions:
//   • Blurred by default — prevents casual shoulder-surfing.
//   • Reveal requires an explicit button click — deliberate action only.
//   • Copy copies plaintext — users need this to write it down or store it
//     in a password manager.
//   • Not shown at all if no vault session is active (v1 Supabase users).
// ---------------------------------------------------------------------------

/**
 * Individual mnemonic word pill — styled to look like a hardware wallet
 * recovery sheet to signal the seriousness of the phrase.
 */
function WordPill({
  index,
  word,
  revealed,
}: {
  index: number;
  word: string;
  revealed: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-mono transition-all duration-300"
      style={{
        background: "var(--color-bg-input, rgba(255,255,255,0.06))",
        border: "1px solid var(--color-border-card)",
        filter: revealed ? "none" : "blur(5px)",
        userSelect: revealed ? "text" : "none",
        WebkitUserSelect: revealed ? "text" : "none",
      }}
    >
      <span
        className="text-xs tabular-nums w-4 shrink-0 text-right"
        style={{ color: "var(--color-text-muted)" }}
      >
        {index + 1}
      </span>
      <span style={{ color: "var(--color-text-primary)" }}>{word}</span>
    </div>
  );
}

export function VaultKeySection() {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  // Read from localStorage on mount — this component only renders client-side.
  useEffect(() => {
    setMnemonic(loadMnemonic());
    const profile = loadProfile();
    if (profile?.name) setProfileName(profile.name);
  }, []);

  // If no vault session, render nothing — this section is v2-only.
  if (!mnemonic) return null;

  const words = mnemonic.trim().split(/\s+/);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS) — silently ignore.
    }
  };

  return (
    <SectionCard
      title="Recovery Key"
      subtitle={
        profileName
          ? `${profileName}'s vault phrase — keep this secret`
          : "Your vault phrase — keep this secret"
      }
    >
      {/* Warning banner */}
      <div
        className="flex items-start gap-2.5 rounded-xl px-3 py-3 mb-4"
        style={{
          background: "rgba(251,191,36,0.10)",
          border: "1px solid rgba(251,191,36,0.25)",
        }}
      >
        <AlertTriangle
          className="h-4 w-4 shrink-0 mt-0.5"
          style={{ color: "#d97706" }}
        />
        <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
          Anyone with this phrase can access your vault. Never share it. There
          is no way to recover your account without it — store it somewhere
          safe, like a password manager or paper backup.
        </p>
      </div>

      {/* Word grid — 4 columns × 3 rows */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {words.map((word, i) => (
          <WordPill key={i} index={i} word={word} revealed={revealed} />
        ))}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          className="gap-2 h-9 text-sm"
          onClick={() => setRevealed((v) => !v)}
          type="button"
        >
          <AnimatePresence mode="wait" initial={false}>
            {revealed ? (
              <motion.span
                key="hide"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Hide
              </motion.span>
            ) : (
              <motion.span
                key="reveal"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <Eye className="h-3.5 w-3.5" />
                Reveal
              </motion.span>
            )}
          </AnimatePresence>
        </Button>

        <Button
          variant="outline"
          className="gap-2 h-9 text-sm"
          onClick={handleCopy}
          disabled={!revealed}
          type="button"
          title={revealed ? "Copy phrase to clipboard" : "Reveal phrase first"}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy phrase
            </>
          )}
        </Button>

        {/* Visual indicator that this key is local-only */}
        <span
          className="ml-auto flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1"
          style={{
            color: "var(--color-text-muted)",
            background: "var(--color-bg-input, rgba(255,255,255,0.05))",
            border: "1px solid var(--color-border-card)",
          }}
        >
          <KeyRound className="h-3 w-3" />
          Stored on this device only
        </span>
      </div>
    </SectionCard>
  );
}
