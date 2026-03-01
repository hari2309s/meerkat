"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button, Input, Label } from "@meerkat/ui";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { createClient } from "@/lib/supabase/client";
import { deriveCredentials, saveMnemonic } from "@/lib/vault-credentials";
import { startNavigationProgress } from "@/components/navigation-progress";

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------
function LoginV2Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/";

  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Validate the mnemonic against the full BIP39 wordlist + checksum.
      if (!validateMnemonic(trimmed, wordlist)) {
        throw new Error(
          "Invalid Key. Make sure you entered all 12 words correctly, in the right order.",
        );
      }

      // 2. Re-derive the same credentials that were used at signup.
      const { email, password } = await deriveCredentials(trimmed);

      // 3. Sign in to Supabase.
      const supabase = createClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        // signInWithPassword returns "Invalid login credentials" when the
        // account doesn't exist — surface a friendlier message.
        if (
          signInError.message
            .toLowerCase()
            .includes("invalid login credentials")
        ) {
          throw new Error(
            "No vault found for this Key. Double-check your phrase or create a new vault.",
          );
        }
        throw signInError;
      }

      if (!data.user) throw new Error("Sign in failed. Please try again.");

      // 4. Persist the mnemonic for future sessions on this device.
      saveMnemonic(trimmed);

      startNavigationProgress();
      // Keep isLoading=true — spinner persists until component unmounts.
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
  };

  return (
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

      <div className="space-y-2">
        <Label htmlFor="key">Your Key</Label>
        <div className="relative">
          <Input
            id="key"
            type={showKey ? "text" : "password"}
            placeholder="Please enter your Key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="pr-11 font-mono"
            required
            disabled={isLoading}
            autoComplete="off"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? (
              <EyeOff
                className="h-5 w-5"
                style={{ color: "var(--color-text-muted)" }}
              />
            ) : (
              <Eye
                className="h-5 w-5"
                style={{ color: "var(--color-text-muted)" }}
              />
            )}
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Enter your 12-word BIP39 recovery phrase, separated by spaces.
        </p>
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-base font-semibold"
        disabled={!key.trim() || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Opening your vault…
          </>
        ) : (
          "Enter my Vault"
        )}
      </Button>

      <div className="flex flex-col items-center gap-3 pt-1">
        <button
          type="button"
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
          onClick={() =>
            setError(
              "Key recovery is not available. Your Key is the only way to access your vault — make sure you keep it in a safe place.",
            )
          }
        >
          I&apos;ve lost my Key
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
