import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";
import { DensSection } from "@/components/dens-section";
import { GrainOverlay } from "@/components/grain-overlay";
import { getDisplayName } from "@meerkat/utils/string";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

  const preferredName = user.user_metadata?.preferred_name || null;
  const greeting = getDisplayName({
    preferred_name: preferredName,
    full_name: name,
  });

  return (
    <div className="min-h-screen page-bg">
      <GrainOverlay />

      <TopNav user={{ name, preferredName, email: user.email ?? "" }} />

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-8 pb-16">
        {/* Greeting */}
        <div className="mb-10 text-center">
          <h2
            className="text-4xl font-bold mb-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            Welcome back, {greeting}!
          </h2>
          <p
            className="text-base"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Pick up where you left off, or start something new.
          </p>
        </div>

        {/* Dens */}
        <DensSection userId={user.id} />
      </main>
    </div>
  );
}
