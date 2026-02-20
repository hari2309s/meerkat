import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DenPageClient } from "@/components/den-page-client";

interface DenPageProps {
  params: { id: string };
}

export default async function DenPage({ params }: DenPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch den — accessible only if user is a member (via RLS)
  const { data: den, error: denErr } = await supabase
    .from("dens")
    .select("*")
    .eq("id", params.id)
    .single();

  if (denErr || !den) notFound();

  // Fetch members with profile data joined
  const { data: members } = await supabase
    .from("den_members")
    .select(
      `
      user_id,
      role,
      joined_at,
      profiles:user_id (
        full_name,
        email
      )
    `,
    )
    .eq("den_id", params.id)
    .order("joined_at", { ascending: true });

  const name =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

  return (
    <DenPageClient
      den={den}
      currentUserId={user.id}
      user={{ name, email: user.email ?? "" }}
      members={(members ?? []) as any}
    />
  );
}
