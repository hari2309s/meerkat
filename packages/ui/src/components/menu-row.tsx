"use client";

import { useState } from "react";

interface MenuRowProps {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  danger?: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  onClick: () => void;
}

export function MenuRow({
  icon: Icon,
  label,
  sublabel,
  danger = false,
  disabled = false,
  badge,
  onClick,
}: MenuRowProps) {
  const [hovered, setHovered] = useState(false);

  const textColor = disabled
    ? "var(--color-text-muted)"
    : danger
      ? hovered
        ? "#ff6e5a"
        : "#e05c4a"
      : hovered
        ? "var(--color-text-primary)"
        : "var(--color-text-secondary)";

  const iconColor = disabled
    ? "var(--color-text-muted)"
    : danger
      ? hovered
        ? "#ff6e5a"
        : "#e05c4a"
      : hovered
        ? "var(--color-avatar-bg)"
        : "var(--color-text-muted)";

  const bgColor =
    hovered && !disabled
      ? danger
        ? "rgba(224,92,74,0.1)"
        : "rgba(138,96,53,0.09)"
      : "transparent";

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm text-left select-none"
      style={{
        color: textColor,
        background: bgColor,
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        margin: "0 5px",
        width: "calc(100% - 10px)",
        transition: "background 0.12s ease, color 0.12s ease",
        border: "none",
        outline: "none",
      }}
    >
      <span
        style={{
          display: "flex",
          flexShrink: 0,
          transition: "transform 0.15s ease",
          transform: hovered && !disabled ? "scale(1.14)" : "scale(1)",
        }}
      >
        <Icon
          className="h-4 w-4"
          style={{ color: iconColor, transition: "color 0.12s ease" }}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate font-medium leading-tight">
          {label}
        </span>
        {sublabel && (
          <span
            className="block text-xs mt-0.5 truncate font-normal leading-tight"
            style={{ color: "var(--color-text-muted)", opacity: 0.8 }}
          >
            {sublabel}
          </span>
        )}
      </span>
      {badge && <span className="shrink-0 ml-1">{badge}</span>}
      {!disabled && (
        <span
          className="shrink-0 text-xs leading-none"
          style={{
            color: danger ? "#e05c4a" : "var(--color-text-muted)",
            opacity: hovered ? 0.45 : 0,
            transform: hovered ? "translateX(3px)" : "translateX(0)",
            transition: "opacity 0.15s ease, transform 0.15s ease",
          }}
        >
          ›
        </span>
      )}
    </button>
  );
}
