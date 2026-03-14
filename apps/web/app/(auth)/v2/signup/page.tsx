"use client";

import { useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button, Input, Label } from "@meerkat/ui";
import {
  Loader2,
  Copy,
  Check,
  ArrowLeft,
  Download,
  ArrowRight,
} from "lucide-react";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  saveMnemonic,
  saveProfile,
  setVaultSessionCookie,
  VAULT_PROFILE_NAME_COOKIE,
} from "@/lib/vault-credentials";
import { startNavigationProgress } from "@/components/navigation-progress";
import {
  createBurrow,
  openBurrowContentDoc,
  closeBurrowContentDoc,
  closeBurrowsDoc,
} from "@meerkat/burrows";
import * as Y from "yjs";

/** Mirror the display name into a cookie so server components can read it. */
function setProfileNameCookie(name: string) {
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${VAULT_PROFILE_NAME_COOKIE}=${encodeURIComponent(name)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

// 128 bits of entropy → 12 words from the canonical 2048-word BIP39 list.
const createMnemonic = () => generateMnemonic(wordlist, 128);

const FIRST_DEN_STORAGE_KEY = "vault_first_den_id";

const WELCOME_LINES = [
  "Welcome to your den. 🦦",
  "",
  "This is your private space. Everything here is encrypted on your device before it goes anywhere. Not even Meerkat can read it.",
  "",
  "Your Key is saved. You're good. Start writing.",
];

async function seedFirstDen(): Promise<string> {
  const denId = crypto.randomUUID();

  // Create the "My first note" burrow.
  const burrow = await createBurrow({
    denId,
    title: "My first note",
    createdBy: "vault",
  });

  // Seed the content doc with welcome paragraphs in Tiptap XML format.
  const { ydoc, fragment } = await openBurrowContentDoc(burrow.yjsDocId);
  ydoc.transact(() => {
    const nodes = WELCOME_LINES.map((line) => {
      const para = new Y.XmlElement("paragraph");
      if (line) {
        const text = new Y.XmlText();
        text.insert(0, line);
        para.insert(0, [text]);
      }
      return para;
    });
    fragment.insert(0, nodes);
  });

  closeBurrowContentDoc(burrow.yjsDocId);
  closeBurrowsDoc(denId);

  localStorage.setItem(FIRST_DEN_STORAGE_KEY, denId);
  return denId;
}

type Step = "intent" | "key" | "name";
type SaveMethod = "copy" | "download" | null;

// ---------------------------------------------------------------------------
// Step 1 — Intent Screen
// ---------------------------------------------------------------------------
function IntentStep({
  onReady,
  onExisting,
}: {
  onReady: () => void;
  onExisting: () => void;
}) {
  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6 space-y-3"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-card)",
        }}
      >
        <p
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Meerkat works differently.
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No email. No password. No way for us to see your data.
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Instead, you get a Key — 12 words that are yours alone.
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          We&apos;ll help you save it safely.
        </p>
      </div>

      <Button
        className="w-full h-12 text-base font-semibold gap-2"
        onClick={onReady}
      >
        I&apos;m ready
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="text-center">
        <button
          onClick={onExisting}
          className="text-sm hover:opacity-70 transition-opacity underline underline-offset-2"
          style={{ color: "var(--color-text-muted)" }}
          type="button"
        >
          I already have a Key
        </button>
      </div>

      <p
        className="text-xs text-center"
        style={{ color: "var(--color-text-muted)" }}
      >
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
// Step 2 — Show & save Key (guided)
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
  const words = mnemonic.split(" ");
  const [revealed, setRevealed] = useState(false);
  const [savedWith, setSavedWith] = useState<SaveMethod>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
    } catch {
      // clipboard unavailable — still count as saved
    }
    setRevealed(true);
    setSavedWith("copy");
  };

  const handleDownload = () => {
    const blob = new Blob(
      [
        `Your Meerkat Key\n\nKeep this file safe. Do not share it.\n\n${mnemonic}\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meerkat-key.txt";
    a.click();
    URL.revokeObjectURL(url);
    setRevealed(true);
    setSavedWith("download");
  };

  const keySaved = savedWith !== null;

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

      <div className="text-center space-y-1.5">
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          This is your Key
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          How would you like to save it?
        </p>
      </div>

      {/* Word cards */}
      <div
        className="rounded-xl p-4 relative overflow-hidden"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-card)",
        }}
      >
        <div
          className="grid grid-cols-3 gap-2 cursor-pointer"
          onClick={() => !revealed && setRevealed(true)}
          title={revealed ? undefined : "Click to reveal your Key"}
        >
          {words.map((word, i) => (
            <div
              key={i}
              className="rounded-lg px-2 py-2 flex items-center gap-1.5"
              style={{
                background: "var(--color-btn-secondary-bg)",
                filter: revealed ? "none" : "blur(5px)",
                transition: "filter 0.3s ease",
                userSelect: revealed ? "text" : "none",
              }}
            >
              <span
                className="text-xs font-mono w-4 shrink-0 text-right"
                style={{ color: "var(--color-text-muted)" }}
              >
                {i + 1}
              </span>
              <span
                className="text-xs font-semibold truncate"
                style={{ color: "var(--color-text-primary)" }}
              >
                {word}
              </span>
            </div>
          ))}
        </div>

        {/* Click-to-reveal overlay */}
        {!revealed && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl cursor-pointer"
            onClick={() => setRevealed(true)}
          >
            <p
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border-card)",
                color: "var(--color-text-muted)",
              }}
            >
              Click to reveal
            </p>
          </div>
        )}
      </div>

      {/* Save options or confirmation */}
      <AnimatePresence mode="wait">
        {!keySaved ? (
          <motion.div
            key="options"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 rounded-xl px-4 h-11 text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border-card)",
                color: "var(--color-text-primary)",
              }}
              type="button"
            >
              <Copy
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              />
              Copy to clipboard
            </button>

            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-3 rounded-xl px-4 h-11 text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border-card)",
                color: "var(--color-text-primary)",
              }}
              type="button"
            >
              <Download
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              />
              Download as text file
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="saved"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              color: "rgb(34, 197, 94)",
            }}
          >
            <Check className="h-4 w-4 shrink-0" />
            Key saved. You&apos;re protected.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Acknowledgement checkbox — only shown after saving */}
      <AnimatePresence>
        {keySaved && (
          <motion.label
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 cursor-pointer select-none"
          >
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
            <span
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              I&apos;ve saved my Key. I know Meerkat can&apos;t recover it for
              me, and that means nobody else can access my den either.
            </span>
          </motion.label>
        )}
      </AnimatePresence>

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
            Setting up your den…
          </>
        ) : (
          "Enter my den"
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

  const [step, setStep] = useState<Step>("intent");
  const [mnemonic] = useState(() => createMnemonic());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = useCallback(
    async (name: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Persist the mnemonic — this IS the user's identity on this device.
        saveMnemonic(mnemonic);

        // 2. Save display name + creation timestamp locally.
        saveProfile({ name, createdAt: new Date().toISOString() });

        // 3. Mirror name into a cookie so server components can read it,
        //    and set the session presence cookie for middleware.
        setProfileNameCookie(name);
        setVaultSessionCookie();

        // 4. Seed the "For You" first den with a welcome note.
        //    Only if there's no redirect target (i.e. fresh signup, not invite flow).
        let destination = nextUrl;
        if (nextUrl === "/") {
          const denId = await seedFirstDen();
          destination = `/dens/${denId}`;
        }

        startNavigationProgress();
        router.push(destination);
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
      {step === "intent" && (
        <motion.div
          key="intent"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25 }}
        >
          <IntentStep
            onReady={() => setStep("key")}
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
            onBack={() => setStep("intent")}
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
