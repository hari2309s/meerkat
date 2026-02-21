import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvitePageClient } from "@/components/invite-page-client";

interface InvitePageProps {
  params: { token: string };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in — send to signup (they likely don't have an account yet).
  // Preserve the invite URL as ?next= so they land back here after auth.
  if (!user) redirect(`/signup?next=/invite/${params.token}`);

  // Look up the invite bypassing RLS using the service role key.
  // We need this because the user is not yet a member, so RLS on `dens` hides the joined data.
  const { createClient: createAdminClient } =
    await import("@supabase/supabase-js");
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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
    // If already a member, just redirect
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
    />
  );
}
