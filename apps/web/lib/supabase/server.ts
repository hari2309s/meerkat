import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { env } from "@meerkat/config";

// @supabase/ssr >=0.4 uses getAll/setAll (replaces get/set/remove).
export function createClient() {
  const cookieStore = cookies();
  const headerStore = headers();
  const ip = headerStore.get("x-real-ip") || headerStore.get("x-forwarded-for");

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: ip ? { "x-forwarded-for": ip } : undefined,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options ?? {}),
            );
          } catch {
            // Called from a Server Component — middleware handles session refresh.
          }
        },
      },
    },
  );
}
