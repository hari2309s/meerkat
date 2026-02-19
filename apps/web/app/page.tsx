import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // preferred_name set on signup → fall back to full_name → fall back to email prefix
  const greeting =
    user.user_metadata?.preferred_name ??
    user.user_metadata?.full_name ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <div className="min-h-screen flex items-center justify-center bg-meerkat-sand">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-meerkat-dark">
          Welcome, {greeting}!
        </h2>
        <p className="text-meerkat-brown">Your workspace is being set up...</p>
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="text-sm text-meerkat-brown underline hover:text-meerkat-dark"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
