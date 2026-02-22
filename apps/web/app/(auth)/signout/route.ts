import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { config } from "@meerkat/config";

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.redirect(new URL(config.auth.loginPath, config.app.url), {
    status: 302,
  });
}
