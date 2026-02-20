"use client";

import { useState } from "react";
import { Users, Crown, Loader2, X, Circle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ModalShell } from "@/components/ui/modal-shell";
import { usePresenceStore } from "@/stores/use-presence-store";
import type { Den, DenMember } from "@/types/den";

interface MembersModalProps {
    den: Den;
    members: DenMember[];
    currentUserId: string;
    isOwner: boolean;
    onClose: () => void;
    onMemberRemoved: (userId: string) => void;
}

export function MembersModal({
    den,
    members,
    currentUserId,
    isOwner,
    onClose,
    onMemberRemoved,
}: MembersModalProps) {
    const [removing, setRemoving] = useState<string | null>(null);
    const onlineUsers = usePresenceStore((s) => s.onlineUsersByDen[den.id]);
    const onlineCount = usePresenceStore((s) => s.onlineByDen[den.id] ?? 0);

    const handleRemove = async (userId: string, displayName: string) => {
        setRemoving(userId);
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("den_members")
                .delete()
                .eq("den_id", den.id)
                .eq("user_id", userId);
            if (error) throw error;
            onMemberRemoved(userId);
            toast.success(`${displayName} removed from ${den.name}`);
        } catch (err: unknown) {
            toast.error("Failed to remove member", {
                description: err instanceof Error ? err.message : undefined,
            });
        } finally {
            setRemoving(null);
        }
    };

    return (
        <ModalShell onClose={onClose} maxWidth="max-w-md">
            <div className="flex items-center gap-3 mb-5">
                <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(138,96,53,0.12)" }}
                >
                    <Users className="h-4 w-4" style={{ color: "var(--color-avatar-bg)" }} />
                </div>
                <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
                        Members
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                        {members.length} {members.length === 1 ? "person" : "people"} in {den.name}
                        {onlineCount > 0 && (
                            <span
                                className="ml-2 inline-flex items-center gap-1"
                                style={{ color: "#22c55e" }}
                            >
                                <Circle className="h-2 w-2 fill-current" />
                                {onlineCount} online
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin -mx-1 px-1">
                {members.map((m) => {
                    const displayName =
                        m.profiles?.full_name ?? m.profiles?.email ?? m.user_id.slice(0, 8);
                    const isYou = m.user_id === currentUserId;
                    const isMemberOwner = m.role === "owner";
                    const isOnline = onlineUsers?.has(m.user_id) ?? false;
                    return (
                        <div
                            key={m.user_id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                            style={{ background: "var(--color-btn-secondary-bg)" }}
                        >
                            <div className="relative shrink-0">
                                <div
                                    className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                                    style={{ background: "var(--color-avatar-bg)" }}
                                >
                                    {displayName[0]?.toUpperCase() ?? "?"}
                                </div>
                                {isOnline && (
                                    <span
                                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
                                        style={{
                                            background: "#22c55e",
                                            borderColor: "var(--color-btn-secondary-bg)",
                                        }}
                                    />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                                    {displayName}
                                    {isYou && (
                                        <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
                                            (you)
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                                    {new Date(m.joined_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </p>
                            </div>
                            {isMemberOwner && (
                                <span
                                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                                    style={{ background: "rgba(138,96,53,0.14)", color: "var(--color-text-secondary)" }}
                                >
                                    <Crown className="h-3 w-3" />
                                    Owner
                                </span>
                            )}
                            {isOwner && !isMemberOwner && (
                                <button
                                    onClick={() => handleRemove(m.user_id, displayName)}
                                    disabled={removing === m.user_id}
                                    className="icon-btn h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ color: "#e05c4a" }}
                                    aria-label={`Remove ${displayName}`}
                                >
                                    {removing === m.user_id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <X className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </ModalShell>
    );
}
