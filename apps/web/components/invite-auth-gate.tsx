"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INVITE_SECRET_STORAGE_KEY = "meerkat:invite-secret";

/**
 * Persist the invite secret key to sessionStorage before redirecting to signup.
 * The hash fragment (#sk=xxx) is lost during redirects, so we save it here
 * for recovery when the user returns to the invite page after auth.
 */
export function persistInviteSecret(token: string): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash?.slice(1) || "";
  const params = new URLSearchParams(hash);
  const sk = params.get("sk");
  if (sk) {
    try {
      sessionStorage.setItem(`${INVITE_SECRET_STORAGE_KEY}:${token}`, sk);
    } catch {
      // Storage may be full or unavailable
    }
  }
}

/**
 * Recover the invite secret from sessionStorage (e.g. after auth redirect).
 * Caller should clear the storage after successful redeem.
 */
export function recoverInviteSecret(token: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sk = sessionStorage.getItem(`${INVITE_SECRET_STORAGE_KEY}:${token}`);
    if (sk) {
      sessionStorage.removeItem(`${INVITE_SECRET_STORAGE_KEY}:${token}`);
      return sk;
    }
  } catch {
    // ignore
  }
  return null;
}

interface InviteAuthGateProps {
  token: string;
}

/**
 * Client component that runs when an unauthenticated user hits an invite page.
 * Saves the URL hash (containing the DenKey secret) to sessionStorage before
 * redirecting to signup, so it can be recovered after auth completes.
 */
export function InviteAuthGate({ token }: InviteAuthGateProps) {
  const router = useRouter();

  useEffect(() => {
    persistInviteSecret(token);
    router.replace(`/signup?next=${encodeURIComponent(`/invite/${token}`)}`);
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Redirecting to sign up…
      </p>
    </div>
  );
}
