/**
 * Server-side helper that returns a unified "current user" object whether the
 * session belongs to a v1 Supabase user or a v2 on-device vault user.
 *
 * V1 (Supabase):  reads the Supabase session cookie → supabase.auth.getUser()
 * V2 (vault):     reads the `vault_session` cookie (presence flag) and the
 *                 `vault_profile` cookie (name, set at login/signup alongside
 *                 localStorage). Returns a synthetic user object.
 *
 * Because server components can't read localStorage, the v2 login/signup
 * pages must also mirror the profile into a cookie (`vault_profile_name`) so
 * that server components can show the display name.
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VAULT_SESSION_COOKIE } from "@/lib/vault-credentials";

export const VAULT_PROFILE_NAME_COOKIE = "vault_profile_name";

export interface CurrentUser {
  /** Supabase UUID for v1 users; deterministic hex for v2 users */
  id: string;
  name: string;
  preferredName: string | null;
  email: string;
  /** "supabase" | "vault" */
  authType: "supabase" | "vault";
}

/**
 * Returns the current user or null if no session exists.
 * Safe to call from any Server Component or Route Handler.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = cookies();

  // ── V2 vault path ────────────────────────────────────────────────────────
  const vaultSession = cookieStore.get(VAULT_SESSION_COOKIE)?.value;
  if (vaultSession === "1") {
    const name =
      cookieStore.get(VAULT_PROFILE_NAME_COOKIE)?.value ?? "Vault User";
    return {
      id: "vault",
      name,
      preferredName: name,
      email: "",
      authType: "vault",
    };
  }

  // ── V1 Supabase path ─────────────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const name =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  const preferredName = user.user_metadata?.preferred_name ?? null;

  return {
    id: user.id,
    name,
    preferredName,
    email: user.email ?? "",
    authType: "supabase",
  };
}
