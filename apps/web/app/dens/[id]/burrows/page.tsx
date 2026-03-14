import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { BurrowsPageClient } from "./burrows-page-client";

interface BurrowsPageProps {
  params: { id: string };
}

export default async function BurrowsPage({ params }: BurrowsPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/v2/login");

  // ── Vault (v2 local-first) path ────────────────────────────────────────────
  if (currentUser.authType === "vault") {
    return (
      <BurrowsPageClient
        denId={params.id}
        denName="For You"
        userId="vault"
        isOwner={true}
        user={{
          name: currentUser.name,
          preferredName: currentUser.preferredName,
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

  const { data: den, error: denErr } = await supabase
    .from("dens")
    .select("id, name, user_id")
    .eq("id", params.id)
    .single();

  if (denErr || !den) notFound();

  const isOwner = den.user_id === user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", user.id)
    .single();

  const fullName =
    profile?.full_name ??
    user.user_metadata?.full_name ??
    user.email?.split("@")[0] ??
    "User";

  return (
    <BurrowsPageClient
      denId={den.id}
      denName={den.name}
      userId={user.id}
      isOwner={isOwner}
      user={{
        name: fullName,
        preferredName: profile?.preferred_name ?? null,
        email: user.email ?? "",
      }}
    />
  );
}
