import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { parseUA } from "@meerkat/utils/ua-parser";
import { getLocation } from "@meerkat/utils/geo";
import { sessionIdFromJWT } from "@meerkat/utils/jwt";

// ── GET /api/account/sessions ───────────────────────────────────────────────

export async function GET() {
  const supabase = createClient();
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Use SECURITY DEFINER RPC — auth schema is not accessible via PostgREST directly.
  // Run migrations/sessions_rpc_functions.sql to create these functions first.
  const { data: rows, error } = await adminClient.rpc("get_user_sessions", {
    p_user_id: session.user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // not by recency, which is wrong when another device refreshed more recently.
  const currentSessionId = sessionIdFromJWT(session.access_token);
  const now = Date.now();
  const withCurrent = enriched
    .filter((s) => !s.notAfter || new Date(s.notAfter).getTime() > now)
    .slice(0, 5)
    .map((s) => ({ ...s, isCurrent: s.id === currentSessionId }))
    .sort((a, b) => (a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1));

  return NextResponse.json({ sessions: withCurrent });
}

// ── DELETE /api/account/sessions?id=<sessionId> ────────────────────────────

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.rpc("delete_user_session", {
    p_session_id: sessionId,
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
