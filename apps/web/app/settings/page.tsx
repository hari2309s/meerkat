import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { SettingsPageClient } from "@/components/settings-page-client";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  // ── Vault (v2 local-first) fast-path ───────────────────────────────────────
  if (currentUser.authType === "vault") {
    return (
      <SettingsPageClient
        user={{
          id: "vault",
          name: currentUser.name,
          preferredName: currentUser.preferredName ?? currentUser.name,
          email: "",
        }}
      />
    );
  }

  // ── Supabase (v1) path ─────────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  const preferredName = user.user_metadata?.preferred_name || null;

  return (
    <SettingsPageClient
      user={{
        id: user.id,
        name,
        preferredName,
        email: user.email ?? "",
        notifPrefs: user.user_metadata?.notification_prefs,
      }}
    />
  );
}
