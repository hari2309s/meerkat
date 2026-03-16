import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, NextRequest } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// 3 account deletion attempts per hour per IP — prevents enumeration / DoS.
const deleteLimiter = createRateLimiter({ limit: 3, windowMs: 60 * 60_000 });

export async function DELETE(req: NextRequest) {
  if (!deleteLimiter.check(getClientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sign out the session cookies after deletion
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
