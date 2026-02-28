import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvitePageClient } from "@/components/invite-page-client";
import { InviteAuthGate } from "@/components/invite-auth-gate";

interface InvitePageProps {
  params: { token: string };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in — render client gate to save hash (#sk=) to sessionStorage
  // before redirecting, so it can be recovered after auth.
  if (!user) {
    return <InviteAuthGate token={params.token} />;
  }

  // Look up the invite bypassing RLS using the service role key.
  // We need this because the user is not yet a member, so RLS on `dens` hides the joined data.
  const supabaseAdmin = createAdminClient();

  const { data: invite, error } = await supabaseAdmin
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
      dens:den_id ( id, name, user_id )
    `,
    )
    .eq("token", params.token)
    .single();

  // Invalid token
  if (error || !invite) {
    return <InvitePageClient status="invalid" />;
  }

  // Already accepted
  if (invite.accepted_at) {
    return <InvitePageClient status="already_used" denId={invite.den_id} />;
  }

  // Expired
  if (new Date(invite.expires_at) < new Date()) {
    return <InvitePageClient status="expired" />;
  }

  // Already a member
  const { data: existingMember } = await supabase
    .from("den_members")
    .select("user_id")
    .eq("den_id", invite.den_id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    const rawDenForMember = invite.dens;
    const denForMember = (
      Array.isArray(rawDenForMember) ? rawDenForMember[0] : rawDenForMember
    ) as { name?: string } | null;
    return (
      <InvitePageClient
        status="already_member"
        denId={invite.den_id}
        denName={denForMember?.name}
      />
    );
  }

  // Supabase returns an array for foreign key joins — normalise to a single object.
  const rawDen = invite.dens;
  const den = (Array.isArray(rawDen) ? rawDen[0] : rawDen) as {
    id: string;
    name: string;
    user_id: string;
  } | null;

  if (!den) {
    return <InvitePageClient status="invalid" />;
  }

  return (
    <InvitePageClient
      status="valid"
      token={params.token}
      inviteId={invite.id}
      den={den}
      currentUserId={user.id}
      userEmail={user.email ?? ""}
      flowerPotToken={invite.flower_pot_token ?? null}
    />
  );
}
