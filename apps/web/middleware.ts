import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@meerkat/config";
import { VAULT_SESSION_COOKIE } from "@/lib/vault-credentials";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  // Check Supabase session (v1 flow)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check vault session cookie (v2 pure on-device flow)
  const hasVaultSession =
    request.cookies.get(VAULT_SESSION_COOKIE)?.value === "1";

  // Either a Supabase user or a vault session cookie counts as "logged in"
  const isLoggedIn = !!user || hasVaultSession;

  const { pathname } = request.nextUrl;

  // Public auth routes — if already logged in, redirect to ?next= or home
  const authRoutes = ["/login", "/signup", "/forgot-password"];
  if (authRoutes.includes(pathname) && isLoggedIn) {
    const next = request.nextUrl.searchParams.get("next") ?? "/";
    const destination =
      next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // V2 auth routes — never redirect away even if logged in (user may want
  // to switch vaults or create a new one)
  const v2AuthRoutes = ["/v2/login", "/v2/signup"];
  if (v2AuthRoutes.includes(pathname)) {
    return response;
  }

  // Protected routes — redirect to login if not logged in
  const publicRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/auth/callback",
    "/auth/confirm",
  ];
  const isPublic =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/invite/");

  if (!isPublic && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
