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

  // Use `unknown` intermediate cast — Supabase's inferred type for the profiles
  // join has a slightly different shape to our DenMember type but the runtime
  // values are identical.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let membersList = (members ?? []) as unknown as {
    user_id: string;
    role: string;
    joined_at: string;
    profiles?: { full_name: string | null; email: string } | null;
  }[];

  if (!membersList.some((m) => m.user_id === den.user_id)) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", den.user_id)
      .single();

    membersList = [
      {
        user_id: den.user_id,
        role: "owner",
        joined_at: den.created_at,
        profiles: ownerProfile ?? { full_name: null, email: "" },
      },
      ...membersList,
    ];
  }

  return (
    <DenPageClient
      den={den}
      currentUserId={user.id}
      user={{ name, email: user.email ?? "" }}
      members={membersList as unknown as any}
    />
  );
}
