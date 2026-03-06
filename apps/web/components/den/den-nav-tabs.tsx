"use client";

import Link from "next/link";
import { startNavigationProgress } from "@/components/navigation-progress";

interface DenNavTabsProps {
  denId: string;
  activeTab: "chat" | "burrows";
}

export function DenNavTabs({ denId, activeTab }: DenNavTabsProps) {
  const tabs = [
    { key: "chat", label: "Chat", href: `/dens/${denId}` },
    { key: "burrows", label: "Burrows", href: `/dens/${denId}/burrows` },
  ] as const;

  return (
    <div
      className="flex items-center gap-1 mb-6 border-b border-border"
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={active}
            onClick={active ? undefined : startNavigationProgress}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors relative",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={{ color: active ? "var(--color-text-primary)" : undefined }}
          >
            {tab.label}
            {active && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: "var(--color-text-primary)" }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
