"use client";

export function SectionCard({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "var(--color-bg-card)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        border: "1.5px solid var(--color-border-card)",
        boxShadow: "var(--color-shadow-card)",
      }}
    >
      <div className="mb-5">
        <h3
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
