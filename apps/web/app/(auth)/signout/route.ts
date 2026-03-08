import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { config } from "@meerkat/config";
import { VAULT_SESSION_COOKIE } from "@/lib/vault-credentials";
import { VAULT_PROFILE_NAME_COOKIE } from "@/lib/get-current-user";

export async function POST() {
  // Sign out of Supabase (v1 users)
  const supabase = createClient();
  await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.redirect(
    new URL(config.auth.loginPath, config.app.url),
    { status: 302 },
  );

  // Clear vault session cookies (v2 users)
  const cookieOpts = { path: "/", maxAge: 0, sameSite: "strict" } as const;
  response.cookies.set(VAULT_SESSION_COOKIE, "", cookieOpts);
  response.cookies.set(VAULT_PROFILE_NAME_COOKIE, "", cookieOpts);

  return response;
}
