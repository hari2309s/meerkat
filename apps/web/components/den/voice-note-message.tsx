"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Mic } from "lucide-react";
import type { Message } from "@/types/den";

interface VoiceNoteMessageProps {
    message: Message;
}

function formatDuration(seconds: number) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoiceNoteMessage({ message }: VoiceNoteMessageProps) {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const senderName =
        message.sender?.full_name ?? message.sender?.email ?? "Unknown";

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.pause();
        } else {
            void audio.play();
        }
        setPlaying(!playing);
    };

    const handleTimeUpdate = () => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleEnded = () => {
        setPlaying(false);
        setProgress(0);
    };

    const duration = message.voice_duration ?? 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 items-end max-w-xs"
        >
            {/* Avatar */}
            <div
                className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: "var(--color-avatar-bg)" }}
            >
                {senderName[0]?.toUpperCase() ?? "?"}
            </div>

            {/* Bubble */}
            <div
                className="rounded-2xl rounded-bl-sm px-4 py-3 flex flex-col gap-2"
                style={{
                    background: "var(--color-bg-card)",
                    border: "1.5px solid var(--color-border-card)",
                    boxShadow: "var(--color-shadow-card)",
                    minWidth: 220,
                }}
            >
                <div className="flex items-center gap-1.5">
                    <Mic className="h-3 w-3 shrink-0" style={{ color: "#d4673a" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                        {senderName}
                    </span>
                </div>

                {/* Waveform + controls */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={togglePlay}
                        className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95"
                        style={{ background: "#d4673a" }}
                        aria-label={playing ? "Pause" : "Play"}
                    >
                        {playing ? (
                            <Pause className="h-4 w-4 text-white fill-white" />
                        ) : (
                            <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                        )}
                    </button>

                    {/* Progress bar */}
                    <div className="flex-1 flex flex-col gap-1">
                        <div
                            className="w-full h-1.5 rounded-full overflow-hidden"
                            style={{ background: "var(--color-btn-secondary-bg)" }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-100"
                                style={{ background: "#d4673a", width: `${progress}%` }}
                            />
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                            {formatDuration(duration)}
                        </span>
                    </div>
                </div>

                {message.voice_url && (
                    <audio
                        ref={audioRef}
                        src={message.voice_url}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleEnded}
                        onPause={() => setPlaying(false)}
                    />
                )}
            </div>
        </motion.div>
    );
}
