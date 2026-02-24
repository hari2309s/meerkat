"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Mic, ChevronDown, ChevronUp } from "lucide-react";
import { formatDuration } from "@meerkat/utils/time";
import { getSenderName } from "@meerkat/utils/string";
import type { Message, MoodLabel, ToneLabel } from "@/types/den";

// ─── Mood colour map — matches tailwind.ts mood tokens ───────────────────────

const MOOD_COLOR: Record<MoodLabel, string> = {
  happy: "#FBBF24",
  sad: "#60A5FA",
  angry: "#F87171",
  fearful: "#A78BFA",
  disgusted: "#34D399",
  surprised: "#FB923C",
  neutral: "#94A3B8",
};

const MOOD_EMOJI: Record<MoodLabel, string> = {
  happy: "😊",
  sad: "😔",
  angry: "😤",
  fearful: "😨",
  disgusted: "😒",
  surprised: "😲",
  neutral: "😐",
};

const TONE_LABEL: Record<ToneLabel, string> = {
  positive: "Positive",
  negative: "Low",
  neutral: "Neutral",
  energetic: "Energetic",
  calm: "Calm",
  tense: "Tense",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MoodBadgeProps {
  mood: MoodLabel;
  tone: ToneLabel;
  confidence: number;
}

function MoodBadge({ mood, tone, confidence }: MoodBadgeProps) {
  const color = MOOD_COLOR[mood];
  const emoji = MOOD_EMOJI[mood];
  const toneLabel = TONE_LABEL[tone];
  const pct = Math.round(confidence * 100);

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5"
      style={{
        background: `${color}18`,
        border: `1px solid ${color}40`,
      }}
    >
      <span className="text-sm leading-none" aria-hidden>
        {emoji}
      </span>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-xs font-semibold capitalize leading-none"
          style={{ color }}
        >
          {mood}
        </span>
        <span
          className="text-[10px] leading-none"
          style={{ color: "var(--color-text-muted)" }}
        >
          {toneLabel} · {pct}%
        </span>
      </div>
    </div>
  );
}

// ─── Valence/arousal bar ──────────────────────────────────────────────────────

interface ValenceBarProps {
  valence: number; // -1 to 1
  arousal: number; // 0 to 1
  mood: MoodLabel;
}

function ValenceBar({ valence, arousal, mood }: ValenceBarProps) {
  const color = MOOD_COLOR[mood];
  // Normalise valence from [-1,1] to [0,100]
  const valencePct = Math.round(((valence + 1) / 2) * 100);
  const arousalPct = Math.round(arousal * 100);

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      {/* Valence bar */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] w-14 shrink-0"
          style={{ color: "var(--color-text-muted)" }}
        >
          Mood
        </span>
        <div
          className="flex-1 h-1 rounded-full overflow-hidden"
          style={{ background: "var(--color-btn-secondary-bg)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${valencePct}%`, background: color }}
          />
        </div>
        <span
          className="text-[10px] w-6 text-right tabular-nums"
          style={{ color: "var(--color-text-muted)" }}
        >
          {valence > 0 ? "+" : ""}
          {valence.toFixed(1)}
        </span>
      </div>

      {/* Arousal bar */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] w-14 shrink-0"
          style={{ color: "var(--color-text-muted)" }}
        >
          Energy
        </span>
        <div
          className="flex-1 h-1 rounded-full overflow-hidden"
          style={{ background: "var(--color-btn-secondary-bg)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${arousalPct}%`, background: color }}
          />
        </div>
        <span
          className="text-[10px] w-6 text-right tabular-nums"
          style={{ color: "var(--color-text-muted)" }}
        >
          {arousalPct}%
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface VoiceNoteMessageProps {
  message: Message;
}

export function VoiceNoteMessage({ message }: VoiceNoteMessageProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const senderName = getSenderName(message.sender);
  const { analysis } = message;

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
  const hasAnalysis = Boolean(
    analysis && analysis.mood && analysis.mood !== "neutral",
  );

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
        {/* Header row */}
        <div className="flex items-center gap-1.5">
          <Mic className="h-3 w-3 shrink-0" style={{ color: "#d4673a" }} />
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--color-text-muted)" }}
          >
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
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Mood badge — shown when analysis is available */}
        {analysis && (
          <div className="flex flex-col gap-0">
            <MoodBadge
              mood={analysis.mood}
              tone={analysis.tone}
              confidence={analysis.confidence}
            />

            {/* Expand toggle for valence/arousal bars + transcript */}
            {hasAnalysis && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 mt-1 self-start"
                style={{ color: "var(--color-text-muted)" }}
                aria-label={expanded ? "Hide details" : "Show details"}
              >
                <span className="text-[10px]">
                  {expanded ? "Less" : "More"}
                </span>
                {expanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}

            <AnimatePresence>
              {expanded && hasAnalysis && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <ValenceBar
                    valence={analysis.valence}
                    arousal={analysis.arousal}
                    mood={analysis.mood}
                  />

                  {/* Transcript — only if non-empty */}
                  {analysis.transcript && (
                    <p
                      className="text-xs mt-2 italic leading-snug"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      &ldquo;{analysis.transcript}&rdquo;
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
