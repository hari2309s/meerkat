import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { env } from "@meerkat/config";

/**
 * Creates a Supabase admin client using the service role key.
 * Bypasses RLS — only use server-side where elevated access is needed.
 */
export function createAdminClient() {
  const headerStore = headers();
  const ip = headerStore.get("x-real-ip") || headerStore.get("x-forwarded-for");

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
      global: {
        headers: ip ? { "x-forwarded-for": ip } : undefined,
      },
    },
  );
}
