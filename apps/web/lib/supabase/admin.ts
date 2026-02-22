import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

/**
 * Creates a Supabase admin client using the service role key.
 * Bypasses RLS — only use server-side where elevated access is needed.
 * Forwards the real client IP so session geo-lookup works correctly.
 */
export function createAdminClient() {
  const headerStore = headers();
  const ip = headerStore.get("x-real-ip") || headerStore.get("x-forwarded-for");

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        headers: ip ? { "x-forwarded-for": ip } : undefined,
      },
    },
  );
}
