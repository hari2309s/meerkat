import { redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { DensSection } from "@/components/dens-section";
import { GrainOverlay } from "@/components/grain-overlay";
import { getCurrentUser } from "@/lib/get-current-user";
import { getDisplayName } from "@meerkat/utils/string";
import { PWAInstallBanner } from "@/components/pwa-install-banner";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const greeting = getDisplayName({
    preferred_name: user.preferredName,
    full_name: user.name,
  });

  return (
    <div className="min-h-screen page-bg">
      <GrainOverlay />

      <TopNav
        user={{
          name: user.name,
          preferredName: user.preferredName,
          email: user.email,
        }}
      />

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-8 pb-16">
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

        {/* Only render dens list for Supabase users — v2 users store dens
            locally in IndexedDB which DensSection reads client-side */}
        <DensSection
          userId={user.authType === "supabase" ? user.id : "local"}
        />
      </main>

      <PWAInstallBanner />
    </div>
  );
}
