import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// ── Lightweight UA parser ────────────────────────────────────────────────────
function parseUA(ua: string | null): {
  browser: string;
  os: string;
  device: string;
} {
  if (!ua)
    return { browser: "Unknown browser", os: "Unknown OS", device: "Unknown" };

  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/MSIE|Trident/.test(ua)) browser = "Internet Explorer";
  else if (/CriOS/.test(ua)) browser = "Chrome (iOS)";
  else if (/FxiOS/.test(ua)) browser = "Firefox (iOS)";

  let os = "Unknown OS";
  if (/iPhone/.test(ua)) os = "iOS (iPhone)";
  else if (/iPad/.test(ua)) os = "iOS (iPad)";
  else if (/Android/.test(ua)) {
    const m = ua.match(/Android ([0-9.]+)/);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/Windows NT/.test(ua)) {
    const m = ua.match(/Windows NT ([0-9.]+)/);
    const versions: Record<string, string> = {
      "10.0": "Windows 11/10",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    os = m ? (versions[m[1]] ?? `Windows NT ${m[1]}`) : "Windows";
  } else if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([0-9_]+)/);
    os = m ? `macOS ${m[1].replace(/_/g, ".")}` : "macOS";
  } else if (/Linux/.test(ua)) os = "Linux";

  let device = "Desktop";
  if (/iPhone|iPod/.test(ua)) device = "iPhone";
  else if (/iPad/.test(ua)) device = "iPad";
  else if (/Android/.test(ua) && /Mobile/.test(ua)) device = "Android Phone";
  else if (/Android/.test(ua)) device = "Android Tablet";

  return { browser, os, device };
}

// ── Geo lookup ─────────────────────────────────────────────────────────────
async function getLocation(rawIp: string): Promise<string> {
  // Postgres inet type serialises as "1.2.3.4/32" — strip the CIDR prefix
  const ip = rawIp?.split("/")[0] ?? "";
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  ) {
    return "Local network";
  }
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName,country`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return ip;
    const data = await res.json();
    if (data.status !== "success") return ip;
    return (
      [data.city, data.regionName, data.country].filter(Boolean).join(", ") ||
      ip
    );
  } catch {
    return ip;
  }
}

// ── Supabase helpers ────────────────────────────────────────────────────────
function makeSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    },
  );
}

function makeAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Decode the Supabase JWT payload and return the session_id claim. */
function sessionIdFromJWT(token: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"),
    );
    return (payload?.session_id as string) ?? null;
  } catch {
    return null;
  }
}

// ── GET /api/account/sessions ───────────────────────────────────────────────
export async function GET() {
  const supabase = makeSupabase();
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = makeAdmin();

  // Use SECURITY DEFINER RPC — auth schema is not accessible via PostgREST directly.
  // Run migration/sessions_rpc_functions.sql to create these functions first.
  const { data: rows, error } = await adminClient.rpc("get_user_sessions", {
    p_user_id: session.user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    (rows ?? []).map(async (s: any) => {
      const { browser, os, device } = parseUA(s.user_agent);
      const location = await getLocation(s.ip ?? "");
      return {
        id: s.id,
        browser,
        os,
        device,
        location,
        ip: s.ip,
        createdAt: s.created_at,
        lastActiveAt: s.updated_at,
        isCurrent: false,
        notAfter: s.not_after,
      };
    }),
  );

  // Decode the current session ID from the JWT so we can mark it exactly —
  // not by recency, which is wrong when the phone refreshed more recently.
  const currentSessionId = sessionIdFromJWT(session.access_token);
  const now = Date.now();
  const withCurrent = enriched
    .filter((s) => !s.notAfter || new Date(s.notAfter).getTime() > now)
    .slice(0, 5)
    .map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
  return NextResponse.json({ sessions: withCurrent });
}

// ── DELETE /api/account/sessions?id=<sessionId> ────────────────────────────
export async function DELETE(request: Request) {
  const supabase = makeSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("id");
  if (!sessionId)
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });

  const adminClient = makeAdmin();

  const { error } = await adminClient.rpc("delete_user_session", {
    p_session_id: sessionId,
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
