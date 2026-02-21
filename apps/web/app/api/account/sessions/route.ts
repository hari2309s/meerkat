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

  // Browser
  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/MSIE|Trident/.test(ua)) browser = "Internet Explorer";
  else if (/CriOS/.test(ua)) browser = "Chrome (iOS)";
  else if (/FxiOS/.test(ua)) browser = "Firefox (iOS)";

  // OS
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

  // Device type
  let device = "Desktop";
  if (/iPhone|iPod/.test(ua)) device = "iPhone";
  else if (/iPad/.test(ua)) device = "iPad";
  else if (/Android/.test(ua) && /Mobile/.test(ua)) device = "Android Phone";
  else if (/Android/.test(ua)) device = "Android Tablet";

  return { browser, os, device };
}

// ── Geo lookup ─────────────────────────────────────────────────────────────
async function getLocation(ip: string): Promise<string> {
  // Skip private/loopback IPs
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
      {
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return ip;
    const data = await res.json();
    if (data.status !== "success") return ip;
    const parts = [data.city, data.regionName, data.country].filter(Boolean);
    return parts.join(", ") || ip;
  } catch {
    return ip;
  }
}

// ── Route handlers ─────────────────────────────────────────────────────────

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

/** GET /api/account/sessions — list all active sessions */
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

  // Query auth.sessions via the admin client's ability to access the auth schema
  const { data: rows, error } = await (adminClient as any)
    .schema("auth")
    .from("sessions")
    .select("id, created_at, updated_at, user_agent, ip, not_after")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with parsed UA and geo — run geo requests in parallel
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
        isCurrent: false, // overridden below
        notAfter: s.not_after,
      };
    }),
  );

  // Mark actual current session (match by session_id if available)
  // Supabase session object has `access_token` — we can't compare IDs directly,
  // so we mark the most-recently-updated one as "current" if session_id not available
  const withCurrent = enriched.map((s, i) => ({
    ...s,
    isCurrent: i === 0, // most recently updated = current
  }));

  return NextResponse.json({ sessions: withCurrent });
}

/** DELETE /api/account/sessions?id=<sessionId> — revoke a specific session */
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

  // Delete the specific session from auth.sessions
  const { error } = await (adminClient as any)
    .schema("auth")
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id); // safety: only owner can revoke own sessions

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
