"use client";

import { useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button, Input, Label } from "@meerkat/ui";
import { Loader2, Copy, Check, ArrowLeft } from "lucide-react";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  saveMnemonic,
  saveProfile,
  setVaultSessionCookie,
} from "@/lib/vault-credentials";
import { startNavigationProgress } from "@/components/navigation-progress";

// 128 bits of entropy → 12 words from the canonical 2048-word BIP39 list.
const createMnemonic = () => generateMnemonic(wordlist, 128);

type Step = "welcome" | "key" | "name";

// ---------------------------------------------------------------------------
// Step 1 — Welcome
// ---------------------------------------------------------------------------
function WelcomeStep({
  onNew,
  onExisting,
}: {
  onNew: () => void;
  onExisting: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Your data is encrypted locally and belongs to you — forever.
      </p>

      <Button className="w-full h-12 text-base font-semibold" onClick={onNew}>
        I am new here
      </Button>

      <Button
        variant="outline"
        className="w-full h-12 font-medium"
        onClick={onExisting}
        type="button"
      >
        I already have a Key
      </Button>

      <p className="text-xs pt-2" style={{ color: "var(--color-text-muted)" }}>
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline hover:opacity-80">
          Terms of Use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:opacity-80">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Show & save Key
// ---------------------------------------------------------------------------
function KeyStep({
  mnemonic,
  onContinue,
  onBack,
}: {
  mnemonic: string;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleRevealAndCopy = async () => {
    setRevealed(true);
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable in some envs — reveal still works
    }
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
        style={{ color: "var(--color-text-muted)" }}
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="text-center space-y-2">
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          This is your Key
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          It replaces login and password. Keep it safe — only you are
          responsible for your data. You can find this Key later in app
          settings.
        </p>
      </div>

      {/* Mnemonic display */}
      <div
        className="rounded-xl p-4 font-mono text-sm text-center leading-relaxed select-none relative overflow-hidden"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-card)",
          color: "var(--color-text-primary)",
          filter: revealed ? "none" : "blur(6px)",
          userSelect: revealed ? "text" : "none",
        }}
        aria-label={revealed ? "Your mnemonic key" : "Key hidden"}
      >
        {mnemonic}
      </div>

      <Button
        variant="outline"
        className="w-full h-11 font-medium gap-2"
        onClick={handleRevealAndCopy}
        type="button"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            {revealed ? "Copy again" : "Reveal and Copy"}
          </>
        )}
      </Button>

      {/* Acknowledgement checkbox */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="sr-only"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span
          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all"
          style={{
            border: acknowledged
              ? "2px solid hsl(var(--meerkat-brown))"
              : "2px solid var(--color-border-card)",
            background: acknowledged
              ? "hsl(var(--meerkat-brown))"
              : "transparent",
            boxShadow: acknowledged
              ? "0 0 0 3px hsl(var(--meerkat-brown) / 0.18)"
              : "none",
          }}
          aria-hidden="true"
        >
          {acknowledged && (
            <svg
              viewBox="0 0 10 8"
              className="h-2.5 w-2.5"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 4l2.5 2.5L9 1" />
            </svg>
          )}
        </span>
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          I have saved my Key in a safe place. I understand I cannot recover my
          account without it.
        </span>
      </label>

      <Button
        variant="outline"
        className="w-full h-11 font-medium"
        onClick={onContinue}
        disabled={!acknowledged}
        type="button"
      >
        Continue
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Display name → save locally
// ---------------------------------------------------------------------------
function NameStep({
  onComplete,
  onBack,
  isLoading,
  error,
}: {
  onComplete: (name: string) => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
        style={{ color: "var(--color-text-muted)" }}
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="text-center space-y-2">
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          What should we call you?
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          This will be your display name in your workspace.
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl p-4 text-sm"
            style={{
              background: "rgba(192, 57, 43, 0.1)",
              border: "1px solid rgba(192, 57, 43, 0.3)",
              color: "#c0392b",
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Meera Kat"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
          autoComplete="name"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onComplete(name.trim());
          }}
        />
      </div>

      <Button
        className="w-full h-12 text-base font-semibold"
        onClick={() => onComplete(name.trim())}
        disabled={!name.trim() || isLoading}
        type="button"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Creating your vault…
          </>
        ) : (
          "Enter my Vault"
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------
function SignUpV2Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/";

  const [step, setStep] = useState<Step>("welcome");
  const [mnemonic] = useState(() => createMnemonic());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = useCallback(
    (name: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Persist the mnemonic — this IS the user's identity on this device.
        saveMnemonic(mnemonic);

        // 2. Save display name + creation timestamp locally.
        saveProfile({ name, createdAt: new Date().toISOString() });

        // 3. Set a cookie so middleware knows a vault session is active.
        setVaultSessionCookie();

        startNavigationProgress();
        router.push(nextUrl);
        router.refresh();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        );
        setIsLoading(false);
      }
    },
    [mnemonic, nextUrl, router],
  );

  return (
    <AnimatePresence mode="wait">
      {step === "welcome" && (
        <motion.div
          key="welcome"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25 }}
        >
          <WelcomeStep
            onNew={() => setStep("key")}
            onExisting={() =>
              router.push(
                `/v2/login${nextUrl !== "/" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`,
              )
            }
          />
        </motion.div>
      )}

      {step === "key" && (
        <motion.div
          key="key"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <KeyStep
            mnemonic={mnemonic}
            onContinue={() => setStep("name")}
            onBack={() => setStep("welcome")}
          />
        </motion.div>
      )}

      {step === "name" && (
        <motion.div
          key="name"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <NameStep
            onComplete={handleComplete}
            onBack={() => setStep("key")}
            isLoading={isLoading}
            error={error}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------
export default function SignUpV2Page() {
  return (
    <AuthLayout title="Encrypted, local," subtitle="yours forever">
      <Suspense
        fallback={
          <div
            className="h-64 animate-pulse rounded-xl"
            style={{ background: "var(--color-bg-card)" }}
          />
        }
      >
        <SignUpV2Form />
      </Suspense>
    </AuthLayout>
  );
}
