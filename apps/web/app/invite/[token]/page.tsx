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

  // Not logged in — redirect to login with return URL
  if (!user) redirect(`/login?next=/invite/${params.token}`);

  // Look up the invite
  const { data: invite, error } = await supabase
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
    return (
      <InvitePageClient
        status="already_member"
        denId={invite.den_id}
        denName={(invite.dens as any)?.name}
      />
    );
  }

  const den = invite.dens as unknown as {
    id: string;
    name: string;
    user_id: string;
  };

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
