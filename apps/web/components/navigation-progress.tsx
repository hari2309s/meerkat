"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * NavigationProgress — a slim top-of-page loading bar that fires on every
 * client-side route change. Uses only CSS animations; no external deps.
 *
 * Drop this inside a <Suspense> boundary in the root layout (required because
 * it calls useSearchParams which opts the component into client-side rendering).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "complete">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef<string>("");

  const currentRoute = pathname + searchParams.toString();

  useEffect(() => {
    const prev = prevPathRef.current;
    if (prev && prev !== currentRoute) {
      // Route changed → flash complete then go idle
      setState("complete");
      timerRef.current = setTimeout(() => setState("idle"), 400);
    }
    prevPathRef.current = currentRoute;
  }, [currentRoute]);

  // Expose a start function so other components can trigger the bar
  useEffect(() => {
    const handleStart = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState("loading");
    };
    window.addEventListener("meerkat:nav-start", handleStart);
    return () => window.removeEventListener("meerkat:nav-start", handleStart);
  }, []);

  if (state === "idle") return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div
        className={`h-full transition-all ${
          state === "loading" ? "nav-progress-loading" : "nav-progress-complete"
        }`}
        style={{
          background:
            "linear-gradient(90deg, var(--color-avatar-bg), hsl(var(--meerkat-orange)), var(--color-avatar-bg))",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}

/** Call this before imperative navigations to start the bar immediately. */
export function startNavigationProgress() {
  window.dispatchEvent(new Event("meerkat:nav-start"));
}
