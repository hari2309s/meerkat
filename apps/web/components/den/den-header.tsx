"use client";

import { motion } from "framer-motion";
import { Crown, Users, BellOff, Circle } from "lucide-react";
import { usePresenceStore } from "@/stores/use-presence-store";
import type { Den } from "@/types/den";

interface DenHeaderProps {
    den: Den;
    memberCount: number;
    isOwner: boolean;
    muted: boolean;
    onMembersClick: () => void;
}

export function DenHeader({
    den,
    memberCount,
    isOwner,
    muted,
    onMembersClick,
}: DenHeaderProps) {
    const onlineCount = usePresenceStore((s) => s.onlineByDen[den.id] ?? 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-10"
        >
            <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                {den.name}
            </h1>
            <p
                className="mt-1.5 text-sm flex items-center flex-wrap gap-2"
                style={{ color: "var(--color-text-muted)" }}
            >
                Created on{" "}
                {new Date(den.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                })}
                {isOwner && (
                    <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "rgba(138,96,53,0.12)", color: "var(--color-text-secondary)" }}
                    >
                        <Crown className="h-3 w-3" />
                        Owner
                    </span>
                )}
                <button
                    onClick={onMembersClick}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ background: "rgba(138,96,53,0.08)", color: "var(--color-text-muted)" }}
                >
                    <Users className="h-3 w-3" />
                    {memberCount} {memberCount === 1 ? "member" : "members"}
                </button>
                {onlineCount > 0 && (
                    <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
                    >
                        <Circle className="h-2.5 w-2.5 fill-current" />
                        {onlineCount} online
                    </span>
                )}
                {muted && (
                    <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "rgba(100,100,100,0.1)", color: "var(--color-text-muted)" }}
                    >
                        <BellOff className="h-3 w-3" />
                        Muted
                    </span>
                )}
            </p>
        </motion.div>
    );
}
