"use client";

import { useState, useRef, useMemo } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { formatDuration, formatMessageTime } from "@meerkat/utils/time";

export interface VoicePlayerCardProps {
  /** Resolved playback URL. Pass null/undefined while loading. */
  src?: string | null;
  /** Shows a spinner in the play button while true. */
  isLoading?: boolean;
  /** Duration in seconds. */
  duration: number;
  /** Optional ISO timestamp displayed below the duration. */
  createdAt?: string;
  /** Flips border-radius for own (right-aligned) messages. */
  isOwn?: boolean;
}

// Stable pseudo-random waveform heights seeded from bar index.
function barHeight(i: number): number {
  // Deterministic: sin + a fixed pseudo-noise term so bars don't jump on re-render.
  return 30 + Math.sin(i * 0.7 + 1.3) * 35 + Math.abs(Math.sin(i * 1.9)) * 25;
}

export function VoicePlayerCard({
  src,
  isLoading = false,
  duration,
  createdAt,
  isOwn = false,
}: VoicePlayerCardProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stable bar heights — computed once, not on every render.
  const barHeights = useMemo(
    () => Array.from({ length: 24 }, (_, i) => barHeight(i)),
    [],
  );

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

  return (
    <>
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{
          minWidth: 200,
          maxWidth: 260,
          background: "var(--color-bg-card)",
          border: `1px solid ${isOwn ? "#d4673a40" : "var(--color-border-card)"}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          borderRadius: isOwn ? "22px 22px 4px 22px" : "22px 22px 22px 4px",
        }}
      >
        {/* Play button */}
        <button
          onClick={togglePlay}
          disabled={isLoading || !src}
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 bg-[#d4673a] shadow-lg hover:brightness-110 disabled:opacity-50"
          aria-label={playing ? "Pause" : "Play"}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : playing ? (
            <Pause className="h-5 w-5 text-white fill-current" />
          ) : (
            <Play className="h-5 w-5 text-white fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform */}
        <div className="flex-1 flex items-center gap-0.5 h-8">
          {barHeights.map((h, i) => {
            const isActive = progress > (i / 24) * 100;
            return (
              <div
                key={i}
                className="w-0.5 rounded-full transition-colors duration-300"
                style={{
                  height: `${h}%`,
                  background: isActive ? "#d4673a" : "rgba(212,103,58,0.15)",
                }}
              />
            );
          })}
        </div>

        {/* Duration / timestamp */}
        <div className="flex flex-col items-end shrink-0 pl-1">
          <span
            className="text-[10px] font-black tabular-nums"
            style={{ color: "#d4673a" }}
          >
            {formatDuration(duration)}
          </span>
          {createdAt && (
            <span
              className="text-[9px] mt-0.5 opacity-50 tabular-nums"
              style={{ color: "var(--color-text-primary)" }}
            >
              {formatMessageTime(createdAt)}
            </span>
          )}
        </div>
      </div>

      {/* Hidden audio element */}
      {src && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPause={() => setPlaying(false)}
        />
      )}
    </>
  );
}
