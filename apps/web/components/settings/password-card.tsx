"use client";

import { toast } from "sonner";
import { Button } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import { SectionCard } from "@/components/settings/shared";

export function PasswordCard({ email }: { email: string }) {
  const handleChangePassword = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent", {
        description: `Check ${email} for the password reset link.`,
      });
    } catch (err: unknown) {
      toast.error("Failed to send reset link", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  };

  return (
    <SectionCard title="Password" subtitle="Manage your account password">
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Change password
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            We&apos;ll send a reset link to {email}
          </p>
        </div>
        <Button variant="outline" onClick={handleChangePassword}>
          Send reset link
        </Button>
      </div>
    </SectionCard>
  );
}
