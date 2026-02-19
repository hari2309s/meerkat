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

  const { data: den, error } = await supabase
    .from("dens")
    .select("*")
    .eq("id", params.id)
    .single();

  // 404 if not found, or if this user isn't the owner and isn't a member
  if (error || !den) notFound();

  const name =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

  return (
    <DenPageClient
      den={den}
      currentUserId={user.id}
      user={{ name, email: user.email ?? "" }}
    />
  );
}
