"use client";

import { useState, Suspense, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@meerkat/ui";
import { Loader2, ArrowLeft } from "lucide-react";
import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  saveMnemonic,
  saveProfile,
  setVaultSessionCookie,
  recordFirstUsed,
  loadProfile,
  VAULT_PROFILE_NAME_COOKIE,
} from "@/lib/vault-credentials";

const FIRST_DEN_STORAGE_KEY = "vault_first_den_id";
import { startNavigationProgress } from "@/components/navigation-progress";

const WORD_COUNT = 12;
const wordSet = new Set(wordlist);

function setProfileNameCookie(name: string) {
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${VAULT_PROFILE_NAME_COOKIE}=${encodeURIComponent(name)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

// ---------------------------------------------------------------------------
// Word validation
// ---------------------------------------------------------------------------
type WordState = "empty" | "valid" | "invalid";

function getWordState(word: string): WordState {
  if (!word) return "empty";
  return wordSet.has(word.toLowerCase().trim()) ? "valid" : "invalid";
}

// ---------------------------------------------------------------------------
// Lost Key screen
// ---------------------------------------------------------------------------
function LostKeyScreen({
  onBack,
  nextUrl,
}: {
  onBack: () => void;
  nextUrl: string;
}) {
  return (
    <motion.div
      key="lost"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
        style={{ color: "var(--color-text-muted)" }}
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="space-y-2">
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Lost your Key?
        </h2>
      </div>

      <div
        className="rounded-xl p-5 space-y-3 text-sm"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-card)",
          color: "var(--color-text-muted)",
        }}
      >
        <p>
          Unfortunately Meerkat can&apos;t recover your account — that&apos;s
          what makes it truly private. No backdoor means no breach.
        </p>
        <p>You can create a new account and start fresh.</p>
      </div>

      <Link
        href={`/v2/signup${nextUrl !== "/" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
        className="mt-4 block"
      >
        <Button className="w-full h-12 text-base font-semibold" type="button">
          Create new account
        </Button>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 12-word input grid
// ---------------------------------------------------------------------------
function WordGrid({
  words,
  onChange,
  disabled,
}: {
  words: string[];
  onChange: (words: string[]) => void;
  disabled: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusNext = useCallback((index: number) => {
    const next = inputRefs.current[index + 1];
    if (next) next.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // On paste of full mnemonic — split and fill all boxes
    const trimmed = value.trim();
    const spaceCount = (trimmed.match(/ /g) ?? []).length;
    if (spaceCount >= 2) {
      const parts = trimmed.split(/\s+/).slice(0, WORD_COUNT);
      const next = [...words];
      parts.forEach((p, i) => {
        next[i] = p.toLowerCase();
      });
      onChange(next);
      // Focus the last filled box
      const lastIdx = Math.min(parts.length - 1, WORD_COUNT - 1);
      setTimeout(() => inputRefs.current[lastIdx]?.focus(), 0);
      return;
    }

    // Single word — strip spaces out (space = advance)
    const hasSpace = value.includes(" ");
    const word = value.replace(/\s+/g, "").toLowerCase();
    const next = [...words];
    next[index] = word;
    onChange(next);
    if (hasSpace && word) focusNext(index);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNext(index);
    }
    if (e.key === "Backspace" && !words[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {words.map((word, i) => {
        const state = getWordState(word);
        return (
          <div key={i} className="relative">
            <span
              className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono pointer-events-none select-none w-4 text-right"
              style={{ color: "var(--color-text-muted)" }}
            >
              {i + 1}
            </span>
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              value={word}
              disabled={disabled}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-full rounded-lg pl-7 pr-2 py-2 text-xs font-semibold outline-none transition-all"
              style={{
                background: "var(--color-btn-secondary-bg)",
                border: `1.5px solid ${
                  state === "valid"
                    ? "rgba(34,197,94,0.6)"
                    : state === "invalid"
                      ? "rgba(239,68,68,0.5)"
                      : "var(--color-border-card)"
                }`,
                color: "var(--color-text-primary)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Name step — shown on a new device where localStorage has no profile
// ---------------------------------------------------------------------------
function NameStep({
  onComplete,
  isLoading,
}: {
  onComplete: (name: string) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <motion.div
      key="name"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div className="text-center space-y-2">
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          What should we call you?
        </h2>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          This device doesn&apos;t have your profile yet.
        </p>
      </div>

      <input
        type="text"
        placeholder="Meera Kat"
        value={name}
        autoFocus
        autoComplete="name"
        disabled={isLoading}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onComplete(name.trim());
        }}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-card)",
          color: "var(--color-text-primary)",
        }}
      />

      <Button
        className="w-full h-12 text-base font-semibold"
        onClick={() => onComplete(name.trim())}
        disabled={!name.trim() || isLoading}
        type="button"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Opening your vault…
          </>
        ) : (
          "Enter my den"
        )}
      </Button>

      <div className="text-center">
        <button
          type="button"
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
          onClick={() => onComplete("")}
          disabled={isLoading}
        >
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------
type View = "login" | "lost" | "name";

function LoginV2Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/";

  const [view, setView] = useState<View>("login");
  const [words, setWords] = useState<string[]>(Array(WORD_COUNT).fill(""));
  const [, setValidatedMnemonic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mnemonic = words.join(" ").trim();
  const filledCount = words.filter((w) => w.trim()).length;
  const allFilled = filledCount === WORD_COUNT;

  function buildDestination(): string {
    if (nextUrl !== "/") return nextUrl;
    const firstDenId = localStorage.getItem(FIRST_DEN_STORAGE_KEY);
    return firstDenId ? `/dens/${firstDenId}` : "/";
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled) return;

    setIsLoading(true);
    setError(null);

    try {
      if (!validateMnemonic(mnemonic, wordlist)) {
        throw new Error(
          "Key is invalid. Check the spelling and order of your words.",
        );
      }

      saveMnemonic(mnemonic);

      const profile = loadProfile();
      if (profile?.name) {
        // Known device — profile already here.
        setProfileNameCookie(profile.name);
        recordFirstUsed();
        setVaultSessionCookie();
        startNavigationProgress();
        router.push(buildDestination());
        router.refresh();
      } else {
        // New device — ask for a display name before finishing.
        setValidatedMnemonic(mnemonic);
        setIsLoading(false);
        setView("name");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleNameComplete = (name: string) => {
    setIsLoading(true);
    const resolvedName = name || "You";
    saveProfile({ name: resolvedName, createdAt: new Date().toISOString() });
    setProfileNameCookie(resolvedName);
    recordFirstUsed();
    setVaultSessionCookie();
    startNavigationProgress();
    router.push(buildDestination());
    router.refresh();
  };

  return (
    <AnimatePresence mode="wait">
      {view === "lost" ? (
        <LostKeyScreen
          key="lost"
          onBack={() => setView("login")}
          nextUrl={nextUrl}
        />
      ) : view === "name" ? (
        <NameStep
          key="name"
          onComplete={handleNameComplete}
          isLoading={isLoading}
        />
      ) : (
        <motion.div
          key="login"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25 }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div className="space-y-3">
              <p
                className="text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                Enter your 12-word Key, one word per box.
              </p>

              <WordGrid
                words={words}
                onChange={(w) => {
                  setWords(w);
                  setError(null);
                }}
                disabled={isLoading}
              />

              <p
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Words are from a standard list. Check spelling if a word shows
                red.
              </p>
            </div>

            {/* Device persistence note */}
            <div
              className="rounded-xl px-4 py-3 text-xs"
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border-card)",
                color: "var(--color-text-muted)",
              }}
            >
              On this device, you&apos;ll stay logged in automatically. On a new
              device, you&apos;ll need your Key.
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={!allFilled || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Opening your vault…
                </>
              ) : (
                "Enter my den"
              )}
            </Button>

            <div className="flex flex-col items-center gap-3 pt-1">
              <button
                type="button"
                className="text-sm hover:opacity-70 transition-opacity"
                style={{ color: "var(--color-text-muted)" }}
                onClick={() => setView("lost")}
              >
                Lost your Key?
              </button>

              <div
                className="w-full border-t"
                style={{ borderColor: "var(--color-border-card)" }}
              />

              <Link
                href={`/v2/signup${nextUrl !== "/" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
                className="text-sm hover:opacity-70 transition-opacity"
                style={{ color: "var(--color-text-muted)" }}
              >
                New here? Create a vault
              </Link>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------
export default function LoginV2Page() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Enter your key to access your vault"
    >
      <Suspense
        fallback={
          <div
            className="h-64 animate-pulse rounded-xl"
            style={{ background: "var(--color-bg-card)" }}
          />
        }
      >
        <LoginV2Form />
      </Suspense>
    </AuthLayout>
  );
}
