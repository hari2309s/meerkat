import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { DenPageClientEnhanced } from "@/components/den-page-client-enhanced";
import { DenProvider } from "@/providers/den-provider";
import type { Den, DenMember } from "@/types/den";

interface DenPageProps {
  params: { id: string };
}

export default async function DenPage({ params }: DenPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/v2/login");

  // ── Vault (v2 local-first) path ────────────────────────────────────────────
  // Dens live in IndexedDB — no Supabase lookup needed. Synthesise a Den
  // object from the URL param so the client components have a consistent shape.
  if (currentUser.authType === "vault") {
    const den: Den = {
      id: params.id,
      name: "For You",
      created_at: new Date().toISOString(),
      user_id: "vault",
    };

    return (
      <DenProvider denId={den.id} readOnly={false}>
        <DenPageClientEnhanced
          den={den}
          currentUserId="vault"
          user={{
            name: currentUser.name,
            preferredName: currentUser.preferredName,
            email: "",
          }}
          members={[]}
        />
      </DenProvider>
    );
  }

  // ── Supabase (v1) path ─────────────────────────────────────────────────────
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
        preferred_name,
        email
      )
    `,
    )
    .eq("den_id", params.id)
    .order("joined_at", { ascending: true });

  const { data: currentUserProfile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", user.id)
    .single();

  const fullName =
    currentUserProfile?.full_name ??
    user.user_metadata?.full_name ??
    user.email?.split("@")[0] ??
    "User";
  const preferredName =
    currentUserProfile?.preferred_name ||
    user.user_metadata?.preferred_name ||
    null;

  // Use `unknown` intermediate cast
  let membersList = (members ?? []) as unknown as {
    user_id: string;
    role: string;
    joined_at: string;
    profiles?: {
      full_name: string | null;
      preferred_name: string | null;
      email: string;
    } | null;
  }[];

  if (!membersList.some((m) => m.user_id === den.user_id)) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name, preferred_name, email")
      .eq("id", den.user_id)
      .single();

    membersList = [
      {
        user_id: den.user_id,
        role: "owner",
        joined_at: den.created_at,
        profiles: ownerProfile ?? {
          full_name: null,
          preferred_name: null,
          email: "",
        },
      },
      ...membersList,
    ];
  }

  const isOwner = den.user_id === user.id;

  return (
    <DenProvider denId={den.id} readOnly={!isOwner}>
      <DenPageClientEnhanced
        den={den}
        currentUserId={user.id}
        user={{ name: fullName, preferredName, email: user.email ?? "" }}
        members={membersList as unknown as DenMember[]}
      />
    </DenProvider>
  );
}
