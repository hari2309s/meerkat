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
    .eq("user_id", user.id)
    .single();

  if (error || !den) notFound();

  const name =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

  return <DenPageClient den={den} user={{ name, email: user.email ?? "" }} />;
}
