import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { config } from "@meerkat/config";
import { VAULT_SESSION_COOKIE } from "@/lib/vault-credentials";

export async function POST() {
  // Sign out of Supabase (v1 users)
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.redirect(
    new URL(config.auth.loginPath, config.app.url),
    { status: 302 },
  );

  // Clear the vault session cookie (v2 users)
  response.cookies.set(VAULT_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "strict",
  });

  return response;
}
