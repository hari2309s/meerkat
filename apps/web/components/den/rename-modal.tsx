"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ModalShell } from "@/components/ui/modal-shell";
import { HoverButton } from "@/components/ui/hover-button";
import type { Den } from "@/types/den";

interface RenameModalProps {
    den: Den;
    onClose: () => void;
    onRenamed: (name: string) => void;
}

export function RenameModal({ den, onClose, onRenamed }: RenameModalProps) {
    const [value, setValue] = useState(den.name);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.select();
    }, []);

    const handleSave = async () => {
        const trimmed = value.trim();
        if (!trimmed) {
            setError("Den name can't be empty.");
            return;
        }
        if (trimmed === den.name) {
            onClose();
            return;
        }
        setSaving(true);
        setError("");
        try {
            const supabase = createClient();
            const { error: dbErr } = await supabase
                .from("dens")
                .update({ name: trimmed })
                .eq("id", den.id);
            if (dbErr) throw dbErr;
            onRenamed(trimmed);
            toast.success("Den renamed", { description: `Now called "${trimmed}"` });
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to rename.");
            setSaving(false);
        }
    };

    return (
        <ModalShell onClose={onClose}>
            <div className="flex items-center gap-3 mb-5">
                <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(138,96,53,0.12)" }}
                >
                    <Pencil className="h-4 w-4" style={{ color: "var(--color-avatar-bg)" }} />
                </div>
                <div>
                    <h2 className="text-base font-bold" style={{ color: "var(--color-text-primary)" }}>
                        Rename den
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                        All members will see the new name instantly
                    </p>
                </div>
            </div>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none mb-1"
                placeholder="Den name"
                autoFocus
            />
            {error ? (
                <p className="text-xs mb-3" style={{ color: "#e07050" }}>{error}</p>
            ) : (
                <div className="mb-3" />
            )}
            <div className="flex gap-2 mt-1">
                <HoverButton variant="secondary" onClick={onClose} className="flex-1 py-2.5 text-sm">
                    Cancel
                </HoverButton>
                <HoverButton
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving || !value.trim()}
                    className="flex-1 py-2.5 text-sm"
                >
                    {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            Save
                        </>
                    )}
                </HoverButton>
            </div>
        </ModalShell>
    );
}
