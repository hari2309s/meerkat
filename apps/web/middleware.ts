import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@meerkat/config";
import { VAULT_SESSION_COOKIE } from "@/lib/vault-credentials";

// ─── CSP nonce generation ─────────────────────────────────────────────────────
//
// A fresh nonce is generated per-request and injected into:
//   1. The x-nonce request header — read by layout.tsx Server Component to
//      stamp the inline theme-detection <script nonce={nonce}>.
//   2. The Content-Security-Policy response header — allows only scripts that
//      carry this nonce, replacing the broad 'unsafe-inline' directive.
//
// 'wasm-unsafe-eval' is kept for onnxruntime-web (ONNX WASM backend).
// 'unsafe-inline' is kept only for style-src (Tailwind + CSS vars) since
// CSS injection is far less dangerous than script injection.

function withCsp(res: NextResponse, nonce: string): NextResponse {
  res.headers.set("Content-Security-Policy", buildCsp(nonce));
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

function buildCsp(nonce: string): string {
  const supabaseHost = clientEnv.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host
    : "*.supabase.co";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      `https://${supabaseHost}`,
      `wss://${supabaseHost}`,
      "https://huggingface.co",
      "https://cdn-lfs.huggingface.co",
      "https://cdn-lfs-us-1.huggingface.co",
    ].join(" "),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  // Generate a fresh base64url nonce for this request.
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  // Forward the nonce to Server Components via a request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // @supabase/ssr >=0.4 uses getAll/setAll (replaces get/set/remove).
  // setAll re-creates the NextResponse with updated cookies so token
  // refreshes propagate to the browser on every request.
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options ?? {}),
          );
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
    return withCsp(
      NextResponse.redirect(new URL(destination, request.url)),
      nonce,
    );
  }

  // V2 auth routes — never redirect away even if logged in (user may want
  // to switch vaults or create a new one)
  const v2AuthRoutes = ["/v2/login", "/v2/signup"];
  if (v2AuthRoutes.includes(pathname)) {
    return withCsp(response, nonce);
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
    return withCsp(
      NextResponse.redirect(new URL("/login", request.url)),
      nonce,
    );
  }

  return withCsp(response, nonce);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
