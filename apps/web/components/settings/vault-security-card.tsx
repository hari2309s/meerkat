"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@meerkat/ui";
import { Loader2, LogOut } from "lucide-react";
import { SectionCard, ConfirmModal } from "@/components/settings/shared";
import { clearVault } from "@/lib/vault-credentials";

export function VaultSecurityCard() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      clearVault();
      router.push("/login");
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <SectionCard
        title="Local account"
        subtitle="Your account is secured by your recovery phrase — no password or server sessions"
      >
        <div className="space-y-4">
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Meerkat never sends your credentials to a server. Your vault key and
            all content live only on this device. To access your dens on another
            device, use your recovery phrase.
          </p>

          <div
            className="border-t pt-4"
            style={{ borderColor: "var(--color-border-card)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Sign out of this device
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Clears your vault from this device. Use your recovery phrase
                  to sign back in.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setSignOutOpen(true)}
                disabled={isSigningOut}
              >
                {isSigningOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing out…
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      <ConfirmModal
        open={signOutOpen}
        onClose={() => !isSigningOut && setSignOutOpen(false)}
        onConfirm={handleSignOut}
        title="Sign out of this device?"
        body="Your vault will be cleared from this browser. You will need your 12-word recovery phrase to sign back in."
        confirmLabel="Sign out"
        confirmVariant="danger"
        loading={isSigningOut}
      />
    </>
  );
}
