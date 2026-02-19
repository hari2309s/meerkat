import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

  const greeting = user.user_metadata?.preferred_name ?? name;

  return (
    <div className="min-h-screen page-bg">
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
          backgroundSize: "150px",
        }}
      />

      <TopNav user={{ name, email: user.email ?? "" }} />

      <main className="relative z-10 max-w-4xl mx-auto px-4">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2
            className="text-4xl font-bold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            Welcome back, {greeting}!
          </h2>
          <p
            className="text-lg"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Your workspace is ready.
          </p>
        </div>
      </main>
    </div>
  );
}
