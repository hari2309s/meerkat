import { getCurrentUser } from "@/lib/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { InvitePageClient } from "@/components/invite-page-client";
import { InviteLandingPage } from "@/components/invite-landing-page";
import { VaultInviteClient } from "@/components/vault-invite-client";

interface InvitePageProps {
  params: { token: string };
}

export default async function InvitePage({ params }: InvitePageProps) {
  // Vault invite: everything is encoded in the URL hash, no server lookup needed.
  // The hash is client-only so we render a client component to parse it.
  if (params.token === "vault") {
    return <VaultInviteClient />;
  }

  const supabaseAdmin = createAdminClient();

  // Fetch the invite upfront (no auth required — service role bypasses RLS).
  // This lets us show the warm landing page to unauthenticated visitors
  // without a separate auth-gated round-trip.
  const { data: invite } = await supabaseAdmin
    .from("den_invites")
    .select(
      `
      id,
      token,
      den_id,
      email,
      expires_at,
      accepted_at,
      flower_pot_token,
      key_type,
      dens:den_id ( id, name, user_id )
    `,
    )
    .eq("token", params.token)
    .single();

  // ── Flower pot fallback ───────────────────────────────────────────────────
  // New-style invites use the flower pot token directly in the URL
  // (no den_invites row required at generation time).
  if (!invite) {
    const { data: pot } = await supabaseAdmin
      .from("flower_pots")
      .select("den_id, expires_at, token")
      .eq("token", params.token)
      .single();

    if (!pot) return <InvitePageClient status="invalid" />;

    if (pot.expires_at && new Date(pot.expires_at) < new Date()) {
      return <InvitePageClient status="expired" />;
    }

    const { data: potDen } = await supabaseAdmin
      .from("dens")
      .select("id, name, user_id")
      .eq("id", pot.den_id)
      .single();

    if (!potDen) return <InvitePageClient status="invalid" />;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return (
        <InviteLandingPage
          token={params.token}
          denName={potDen.name}
          keyType="house-sit"
        />
      );
    }

    if (currentUser.authType === "vault") {
      return (
        <InvitePageClient
          status="valid"
          token={params.token}
          den={potDen}
          currentUserId={currentUser.id}
          currentUserName={currentUser.preferredName ?? currentUser.name}
          flowerPotToken={params.token}
          keyType="house-sit"
          isVaultUser
        />
      );
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return (
        <InviteLandingPage
          token={params.token}
          denName={potDen.name}
          keyType="house-sit"
        />
      );
    }

    return (
      <InvitePageClient
        status="valid"
        token={params.token}
        den={potDen}
        currentUserId={user.id}
        currentUserName={currentUser.preferredName ?? currentUser.name}
        userEmail={user.email ?? ""}
        flowerPotToken={params.token}
        keyType="house-sit"
      />
    );
  }

  // ── Legacy path: den_invites row found ────────────────────────────────────

  const rawDen = invite?.dens;
  const den = (Array.isArray(rawDen) ? rawDen[0] : rawDen) as {
    id: string;
    name: string;
    user_id: string;
  } | null;

  const keyType = (invite?.key_type as string | null) ?? "house-sit";

  if (!den) {
    return <InvitePageClient status="invalid" />;
  }

  if (invite.accepted_at) {
    return (
      <InvitePageClient
        status="already_used"
        denId={invite.den_id}
        denName={den.name}
      />
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return <InvitePageClient status="expired" denName={den.name} />;
  }

  const currentUser = await getCurrentUser();

  // ── Unauthenticated ──────────────────────────────────────────────────────────
  // Show warm landing page — no redirect, no auth wall.
  if (!currentUser) {
    return (
      <InviteLandingPage
        token={params.token}
        denName={den.name}
        keyType={keyType}
      />
    );
  }

  // ── Vault (v2 local-first) user ──────────────────────────────────────────────
  if (currentUser.authType === "vault") {
    return (
      <InvitePageClient
        status="valid"
        token={params.token}
        inviteId={invite.id}
        den={den}
        currentUserId={currentUser.id}
        currentUserName={currentUser.preferredName ?? currentUser.name}
        flowerPotToken={invite.flower_pot_token ?? null}
        keyType={keyType}
        isVaultUser
      />
    );
  }

  // ── Supabase (v1) user ───────────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <InviteLandingPage
        token={params.token}
        denName={den.name}
        keyType={keyType}
      />
    );
  }

  const { data: existingMember } = await supabase
    .from("den_members")
    .select("user_id")
    .eq("den_id", invite.den_id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    return (
      <InvitePageClient
        status="already_member"
        denId={invite.den_id}
        denName={den.name}
      />
    );
  }

  return (
    <InvitePageClient
      status="valid"
      token={params.token}
      inviteId={invite.id}
      den={den}
      currentUserId={user.id}
      currentUserName={currentUser.preferredName ?? currentUser.name}
      userEmail={user.email ?? ""}
      flowerPotToken={invite.flower_pot_token ?? null}
      keyType={keyType}
    />
  );
}
