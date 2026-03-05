import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BurrowsPageClient } from "./burrows-page-client";

interface BurrowsPageProps {
  params: { id: string };
}

export default async function BurrowsPage({ params }: BurrowsPageProps) {
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

  return (
    <BurrowsPageClient
      denId={den.id}
      denName={den.name}
      userId={user.id}
      isOwner={isOwner}
    />
  );
}
