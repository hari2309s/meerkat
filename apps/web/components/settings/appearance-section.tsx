"use client";

import { toast } from "sonner";
import { Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { SectionCard } from "@/components/settings/shared";

const THEME_OPTIONS = [
  {
    value: "light" as const,
    label: "Light",
    preview: "linear-gradient(135deg, #f5e6d3, #d4a574)",
    cardBg: "rgba(255,248,240,0.9)",
    labelColor: "#3a2718",
  },
  {
    value: "dark" as const,
    label: "Dark",
    preview: "linear-gradient(135deg, #1a0f08, #3a200a)",
    cardBg: "rgba(30,18,8,0.9)",
    labelColor: "#e8d5bc",
  },
  {
    value: "system" as const,
    label: "System",
    preview:
      "linear-gradient(135deg, #f5e6d3 0%, #f5e6d3 50%, #1a0f08 50%, #3a200a 100%)",
    cardBg: "rgba(139,111,71,0.15)",
    labelColor: "var(--color-text-primary)",
  },
] as const;

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <SectionCard title="Theme" subtitle="Choose how Meerkat looks for you">
      <div className="grid grid-cols-3 gap-3">
        {THEME_OPTIONS.map(({ value, label, preview, cardBg, labelColor }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              onClick={() => {
                setTheme(value);
                toast.success(`Theme set to ${label}`, { duration: 1500 });
              }}
              className={`theme-option ${active ? "theme-active" : ""} relative rounded-xl p-4 text-left border-2 focus:outline-none transition-all duration-150`}
              style={{
                background: cardBg,
                borderColor: active
                  ? "var(--color-avatar-bg)"
                  : "rgba(139,111,71,0.2)",
              }}
            >
              <div
                className="h-10 rounded-lg mb-3"
                style={{ background: preview }}
              />
              <p className="text-sm font-medium" style={{ color: labelColor }}>
                {label}
              </p>
              {active && (
                <div
                  className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full flex items-center justify-center"
                  style={{ background: "var(--color-avatar-bg)" }}
                >
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs mt-4" style={{ color: "var(--color-text-muted)" }}>
        Your preference is saved locally and applied on every visit. System
        follows your OS setting.
      </p>
    </SectionCard>
  );
}
