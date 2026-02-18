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

  // If user is authenticated, redirect to workspace
  // For now, we'll create a simple dashboard later
  return (
    <div className="min-h-screen flex items-center justify-center bg-meerkat-sand">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-meerkat-dark mb-2">
          Welcome to Meerkat!
        </h2>
        <p className="text-meerkat-brown">Your workspace is being set up...</p>
      </div>
    </div>
  );
}
