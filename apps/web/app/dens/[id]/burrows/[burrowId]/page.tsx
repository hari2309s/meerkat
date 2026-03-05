import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BurrowEditorPage } from "./burrow-editor-page";

interface BurrowPageProps {
  params: { id: string; burrowId: string };
}

export default async function BurrowPage({ params }: BurrowPageProps) {
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

  const fullName: string =
    user.user_metadata?.preferred_name ??
    user.user_metadata?.full_name ??
    user.email?.split("@")[0] ??
    "User";

  return (
    <BurrowEditorPage
      denId={den.id}
      denName={den.name}
      burrowId={params.burrowId}
      userId={user.id}
      userName={fullName}
      isOwner={isOwner}
    />
  );
}
