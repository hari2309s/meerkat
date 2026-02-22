"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Label } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { SectionCard } from "@/components/settings/shared";
import { getInitials } from "@meerkat/utils/string";
import type { SettingsUser } from "@/components/settings/types";

export function ProfileSection({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [preferredName, setPreferredName] = useState(user.preferredName);
  const [isSaving, setIsSaving] = useState(false);

  const avatarInitials = getInitials(preferredName || name);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: name,
          preferred_name: preferredName.trim() || name,
        },
      });
      if (error) throw error;
      router.refresh();
      toast.success("Profile updated", {
        description: "Your changes have been saved.",
      });
    } catch (err: unknown) {
      toast.error("Failed to save", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SectionCard
        title="Personal Info"
        subtitle="Update your name and display preferences"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preferred-name">Preferred name</Label>
            <Input
              id="preferred-name"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="What we call you"
            />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Used to greet you when you sign in
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-display">Email</Label>
            <Input
              id="email-display"
              value={user.email}
              disabled
              className="opacity-60 cursor-not-allowed"
            />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Email cannot be changed here
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Avatar"
        subtitle="Your avatar is generated from your initials"
      >
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0 transition-transform duration-150 hover:scale-105"
            style={{ background: "var(--color-avatar-bg)" }}
          >
            {avatarInitials}
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              {preferredName || name}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Custom avatar upload coming soon
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
