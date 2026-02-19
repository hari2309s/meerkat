import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPageClient } from "@/components/settings-page-client";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

  const preferredName = user.user_metadata?.preferred_name ?? name;

  return (
    <SettingsPageClient
      user={{
        id: user.id,
        name,
        preferredName,
        email: user.email ?? "",
      }}
    />
  );
}
