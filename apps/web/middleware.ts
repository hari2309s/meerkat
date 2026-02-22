import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@meerkat/config";

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

  // Refresh session — keeps the user logged in across requests
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public auth routes — if already logged in, go to ?next= or home
  const authRoutes = ["/login", "/signup", "/forgot-password"];
  if (authRoutes.includes(pathname) && user) {
    const next = request.nextUrl.searchParams.get("next") ?? "/";
    const destination =
      next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return NextResponse.redirect(new URL(destination, request.url));
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

  if (!isPublic && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
