"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { persistInviteSecret } from "@meerkat/keys";

export { recoverInviteSecret } from "@meerkat/keys";

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
