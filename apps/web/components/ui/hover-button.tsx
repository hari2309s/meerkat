"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type ButtonVariant = "primary" | "secondary" | "danger";

interface HoverButtonProps {
    variant?: ButtonVariant;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    children: React.ReactNode;
}

const styleMap: Record<ButtonVariant, (hovered: boolean) => React.CSSProperties> = {
    primary: (hovered) => ({
        background: hovered
            ? "var(--color-btn-default-bg-hover)"
            : "var(--color-btn-default-bg)",
        color: "var(--color-btn-default-text)",
        boxShadow: hovered
            ? "0 6px 20px var(--color-btn-default-shadow)"
            : "0 3px 12px var(--color-btn-default-shadow)",
    }),
    secondary: (hovered) => ({
        background: hovered
            ? "var(--color-btn-secondary-bg-hover)"
            : "var(--color-btn-secondary-bg)",
        color: "var(--color-btn-secondary-text)",
    }),
    danger: (hovered) => ({
        background: hovered ? "#a93226" : "#c0392b",
        color: "#fff",
        boxShadow: hovered
            ? "0 6px 20px rgba(192,57,43,0.45)"
            : "0 3px 12px rgba(192,57,43,0.28)",
    }),
};

export function HoverButton({
    variant = "primary",
    onClick,
    disabled = false,
    className = "",
    children,
}: HoverButtonProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <motion.button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => !disabled && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            whileHover={!disabled ? { y: -1 } : {}}
            whileTap={!disabled ? { scale: 0.96 } : {}}
            className={`rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            style={styleMap[variant](hovered)}
        >
            {children}
        </motion.button>
    );
}
