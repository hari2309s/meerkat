"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { SectionCard, Toggle } from "@/components/settings/shared";
import type { NotifPrefs, SettingsUser } from "@/components/settings/types";

const NOTIF_ROWS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    {
        key: "emailActivity",
        label: "Email — Activity",
        desc: "Messages and replies in your dens",
    },
    {
        key: "emailDigest",
        label: "Email — Weekly digest",
        desc: "A summary of activity across your dens",
    },
    {
        key: "pushMessages",
        label: "Push — New messages",
        desc: "Real-time alerts for new messages",
    },
    {
        key: "pushMentions",
        label: "Push — Mentions",
        desc: "Notify when someone mentions you",
    },
];

export function NotificationsSection({ user }: { user: SettingsUser }) {
    const [notifs, setNotifs] = useState<NotifPrefs>({
        emailActivity: user.notifPrefs?.emailActivity ?? true,
        emailDigest: user.notifPrefs?.emailDigest ?? false,
        pushMessages: user.notifPrefs?.pushMessages ?? true,
        pushMentions: user.notifPrefs?.pushMentions ?? true,
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({
                data: { notification_prefs: notifs },
            });
            if (error) throw error;
            toast.success("Notification preferences saved");
        } catch (err: unknown) {
            toast.error("Failed to save preferences", {
                description:
                    err instanceof Error ? err.message : "Something went wrong.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SectionCard
            title="Notification Preferences"
            subtitle="Choose what you hear about and how"
        >
            <div className="divide-y divide-meerkat-tan/20">
                {NOTIF_ROWS.map(({ key, label, desc }) => (
                    <div
                        key={key}
                        className="flex items-center justify-between py-4 first:pt-0 last:pb-0 px-1 cursor-pointer"
                        onClick={() =>
                            setNotifs((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                    >
                        <div>
                            <p
                                className="text-sm font-medium"
                                style={{ color: "var(--color-text-primary)" }}
                            >
                                {label}
                            </p>
                            <p
                                className="text-xs mt-0.5"
                                style={{ color: "var(--color-text-secondary)" }}
                            >
                                {desc}
                            </p>
                        </div>
                        <Toggle
                            checked={notifs[key]}
                            onChange={(v) => setNotifs((prev) => ({ ...prev, [key]: v }))}
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-end pt-4 border-t border-meerkat-tan/20 mt-2">
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="min-w-[140px]"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Save preferences"
                    )}
                </Button>
            </div>
        </SectionCard>
    );
}
