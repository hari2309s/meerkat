"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Den } from "@/types/den";

const DEN_SUGGESTIONS = ["Family", "Friends", "Work", "For You", "Creative"];

interface CreateDenModalProps {
    onClose: () => void;
    onCreated: (den: Den) => void;
    userId: string;
}

export function CreateDenModal({ onClose, onCreated, userId }: CreateDenModalProps) {
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (trimmed: string) => {
            const supabase = createClient();
            const { data, error: dbError } = await supabase
                .from("dens")
                .insert({ name: trimmed, user_id: userId })
                .select()
                .single();
            if (dbError) throw dbError;
            return data as Den;
        },
        onSuccess: (den) => {
            queryClient.invalidateQueries({ queryKey: ["dens", userId] });
            onCreated(den);
        },
        onError: (err: Error) => {
            setError(err.message);
        },
    });

    const handleCreate = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Please give your den a name.");
            return;
        }
        setError("");
        mutation.mutate(trimmed);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="relative w-full max-w-md rounded-2xl p-6"
                style={{
                    background: "var(--color-bg-card)",
                    border: "1.5px solid var(--color-border-card)",
                    boxShadow: "var(--color-shadow-card)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="icon-btn absolute right-4 top-4 rounded-lg p-1.5"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    <X className="h-4 w-4" />
                </button>

                <h2 className="text-xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
                    Create a den
                </h2>
                <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
                    Dens are your spaces to gather, share, and connect.
                </p>

                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Name your den…"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
                        autoFocus
                    />
                    {error && (
                        <p className="mt-2 text-xs" style={{ color: "#e07050" }}>{error}</p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    {DEN_SUGGESTIONS.map((suggestion) => (
                        <button
                            key={suggestion}
                            onClick={() => setName(suggestion)}
                            className="rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:scale-[1.04] active:scale-95"
                            style={{
                                background: name === suggestion ? "var(--color-btn-default-bg)" : "var(--color-btn-secondary-bg)",
                                color: name === suggestion ? "var(--color-btn-default-text)" : "var(--color-btn-secondary-text)",
                            }}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleCreate}
                    disabled={mutation.isPending || !name.trim()}
                    className="btn-default w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {mutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            <Plus className="h-4 w-4" />
                            Create den
                        </>
                    )}
                </button>
            </motion.div>
        </div>
    );
}
