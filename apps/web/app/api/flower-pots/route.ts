import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/flower-pots
// Body: { denId: string, encryptedBundle: string, expiresAt: string | null }
// Returns: { token: string }
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    denId: string;
    encryptedBundle: string;
    expiresAt: string | null;
  };

  const { data, error } = await supabase
    .from("flower_pots")
    .insert({
      den_id: body.denId,
      encrypted_bundle: body.encryptedBundle,
      expires_at: body.expiresAt,
      created_by: user.id,
    })
    .select("token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token: data.token });
}

// GET /api/flower-pots?token=X
// Returns: { encryptedBundle: string } | 404
// Public — anyone with the token can fetch (RLS enforces TTL)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  // Use admin client so we can read across RLS boundaries (RLS already
  // enforces expiry via the SELECT policy; admin bypasses only auth checks).
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("flower_pots")
    .select("encrypted_bundle, expires_at")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json(null, { status: 404 });
  }

  // Double-check expiry server-side (defence in depth)
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json({ encryptedBundle: data.encrypted_bundle });
}

// DELETE /api/flower-pots?token=X
// Requires auth — only the creator can revoke their own flower pot
export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS "Creator can delete" policy enforces ownership
  const { error } = await supabase
    .from("flower_pots")
    .delete()
    .eq("token", token);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
