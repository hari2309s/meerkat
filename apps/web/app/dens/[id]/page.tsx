import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  VAULT_OWNED_DENS_COOKIE,
  VAULT_ALL_DENS_COOKIE,
} from "@/lib/vault-dens";
import { DenPageClientEnhanced } from "@/components/den-page-client";
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
    // Determine ownership from the vault_owned_dens cookie (maintained
    // client-side by addVaultDen/removeVaultDen). If the cookie is absent
    // (legacy session that pre-dates this field) we assume the user is the
    // owner — a safe fallback because visitors always have the cookie set
    // when they accept an invite.
    const cookieStore = cookies();

    // Resolve ownership from the vault_owned_dens cookie.
    const rawOwnedDens = cookieStore.get(VAULT_OWNED_DENS_COOKIE)?.value;
    let isVaultOwner = true; // safe default for legacy sessions
    if (rawOwnedDens) {
      try {
        const ownedIds = JSON.parse(
          decodeURIComponent(rawOwnedDens),
        ) as string[];
        isVaultOwner = ownedIds.includes(params.id);
      } catch {
        // malformed cookie — keep the safe default
      }
    }

    // Resolve den name from the vault_all_dens cookie (includes joined dens).
    let denName = "Den";
    const rawAllDens = cookieStore.get(VAULT_ALL_DENS_COOKIE)?.value;
    if (rawAllDens) {
      try {
        const allDens = JSON.parse(decodeURIComponent(rawAllDens)) as {
          id: string;
          name: string;
        }[];
        denName = allDens.find((d) => d.id === params.id)?.name ?? "Den";
      } catch {
        // malformed cookie — keep the fallback
      }
    }

    const den: Den = {
      id: params.id,
      name: denName,
      created_at: new Date().toISOString(),
      user_id: currentUser.id,
    };

    return (
      <DenProvider denId={den.id} readOnly={!isVaultOwner}>
        <DenPageClientEnhanced
          den={den}
          currentUserId={currentUser.id}
          authType="vault"
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
        authType="supabase"
        user={{ name: fullName, preferredName, email: user.email ?? "" }}
        members={membersList as unknown as DenMember[]}
      />
    </DenProvider>
  );
}
