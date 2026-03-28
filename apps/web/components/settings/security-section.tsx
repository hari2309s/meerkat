"use client";

import type { SettingsUser } from "@/components/settings/types";
import { PasswordCard } from "@/components/settings/password-card";
import { SessionsCard } from "@/components/settings/sessions-card";
import { DangerZoneCard } from "@/components/settings/danger-zone-card";
import { VaultSecurityCard } from "@/components/settings/vault-security-card";

export function SecuritySection({ user }: { user: SettingsUser }) {
  if (user.id === "vault") {
    return <VaultSecurityCard />;
  }

  return (
    <>
      <PasswordCard email={user.email} />
      <SessionsCard />
      <DangerZoneCard email={user.email} />
    </>
  );
}
