"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

interface ModalShellProps {
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
}

export function ModalShell({
    onClose,
    children,
    maxWidth = "max-w-sm",
}: ModalShellProps) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(8px)" }}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                transition={{ type: "spring", stiffness: 440, damping: 34 }}
                className={`relative w-full ${maxWidth} rounded-2xl p-6`}
                style={{
                    background: "var(--color-bg-card)",
                    border: "1.5px solid var(--color-border-card)",
                    boxShadow:
                        "0 24px 64px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.06) inset",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="icon-btn absolute right-4 top-4 rounded-xl p-1.5"
                    style={{ color: "var(--color-text-muted)" }}
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>
                {children}
            </motion.div>
        </div>
    );
}
