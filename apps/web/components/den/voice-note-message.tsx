"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { formatDuration, formatMessageTime } from "@meerkat/utils/time";
import { getInitials, getSenderName } from "@meerkat/utils/string";
import type { Message, MoodLabel, ToneLabel } from "@/types/den";
import { useVoiceUrl } from "@/hooks/use-voice-url";

// ─── Mood colour map ──────────────────────────────────────────────────────────

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

// ─── Compact mood side panel (detail content only) ───────────────────────────

interface MoodSidePanelProps {
  mood: MoodLabel;
  tone: ToneLabel;
  valence: number;
  arousal: number;
  confidence: number;
  transcript?: string;
  isOwn: boolean;
}

function MoodSidePanel({
  mood,
  tone,
  valence,
  arousal,
  confidence,
  transcript,
  isOwn,
}: MoodSidePanelProps) {
  const color = MOOD_COLOR[mood];
  const toneLabel = TONE_LABEL[tone];
  const pct = Math.round(confidence * 100);
  const valencePct = Math.round(((valence + 1) / 2) * 100);
  const arousalPct = Math.round(arousal * 100);

  return (
    <div
      className={`flex flex-col gap-2 shrink-0 ${isOwn ? "items-end" : "items-start"}`}
      style={{ width: 112 }}
    >
      {/* Tone · confidence label */}
      <div
        className="text-[10px] font-semibold leading-none px-0.5 truncate w-full"
        style={{ color: "var(--color-text-muted)" }}
      >
        {toneLabel} · {pct}%
      </div>

      {/* Compact valence / arousal bars */}
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center gap-1">
          <span
            className="text-[9px] w-8 shrink-0 leading-none"
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
        </div>
        <div className="flex items-center gap-1">
          <span
            className="text-[9px] w-8 shrink-0 leading-none"
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
        </div>
      </div>

      {/* Transcript */}
      {transcript && (
        <p
          className="text-[10px] italic leading-relaxed line-clamp-3"
          style={{ color: "var(--color-text-primary)", opacity: 0.75 }}
        >
          &ldquo;{transcript}&rdquo;
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface VoiceNoteMessageProps {
  message: Message;
  isOwn: boolean;
}

export function VoiceNoteMessage({ message, isOwn }: VoiceNoteMessageProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [moodExpanded, setMoodExpanded] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const displayName = getSenderName(message.sender);
  const initialsSource =
    message.sender?.full_name || message.sender?.email || "Unknown";

  const { analysis } = message;
  const moodColor = analysis ? MOOD_COLOR[analysis.mood] : null;
  const moodEmoji = analysis ? MOOD_EMOJI[analysis.mood] : null;
  const signedUrl = useVoiceUrl(message.voice_url);

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
      className={`flex gap-2 items-end ${isOwn ? "flex-row-reverse self-end" : ""}`}
    >
      {/* Avatar */}
      <div
        className="h-9 w-9 rounded-2xl flex items-center justify-center text-xs font-bold text-white shrink-0 mb-1"
        style={{
          background: isOwn ? "#d4673a" : "var(--color-avatar-bg)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        {getInitials(initialsSource)}
      </div>

      {/* Name + Bubble + Audio */}
      <div
        className={`flex flex-col gap-1.5 ${isOwn ? "items-end" : "items-start"}`}
      >
        <span
          className="text-[11px] font-bold px-1 uppercase tracking-tight opacity-70"
          style={{ color: "var(--color-text-primary)" }}
        >
          {displayName}
        </span>

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
          {/* Play Button */}
          <button
            onClick={togglePlay}
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 bg-[#d4673a] shadow-lg hover:brightness-110"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="h-5 w-5 text-white fill-current" />
            ) : (
              <Play className="h-5 w-5 text-white fill-current ml-0.5" />
            )}
          </button>

          {/* Waveform */}
          <div className="flex-1 flex items-center gap-0.5 h-8">
            {Array.from({ length: 24 }).map((_, i) => {
              const barProgress = (i / 24) * 100;
              const isActive = progress > barProgress;
              return (
                <div
                  key={i}
                  className="w-0.5 rounded-full transition-all duration-300"
                  style={{
                    height: `${30 + Math.sin(i * 0.5) * 40 + Math.random() * 30}%`,
                    background: isActive ? "#d4673a" : "rgba(212,103,58,0.15)",
                  }}
                />
              );
            })}
          </div>

          {/* Duration / Time */}
          <div className="flex flex-col items-end shrink-0 pl-1">
            <span
              className="text-[10px] font-black tabular-nums"
              style={{ color: "#d4673a" }}
            >
              {formatDuration(duration)}
            </span>
            <span
              className="text-[9px] mt-0.5 opacity-50 tabular-nums"
              style={{ color: "var(--color-text-primary)" }}
            >
              {formatMessageTime(message.created_at)}
            </span>
          </div>
        </div>

        {signedUrl && (
          <audio
            ref={audioRef}
            src={signedUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPause={() => setPlaying(false)}
          />
        )}
      </div>

      {/* Mood toggle + collapsible detail panel */}
      {analysis && moodColor && moodEmoji && (
        <div
          className={`self-center flex items-center gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`}
        >
          {/* Always-visible emoji toggle button */}
          <button
            onClick={() => setMoodExpanded((v) => !v)}
            className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110 active:scale-95"
            style={{
              background: `${moodColor}18`,
              border: `1px solid ${moodColor}40`,
            }}
            aria-label={moodExpanded ? "Collapse mood" : "Expand mood"}
            title={moodExpanded ? "Hide mood details" : "Show mood details"}
          >
            {moodEmoji}
          </button>

          {/* Animated expandable detail panel */}
          <AnimatePresence>
            {moodExpanded && (
              <motion.div
                key="mood-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 112, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <MoodSidePanel
                  mood={analysis.mood}
                  tone={analysis.tone}
                  valence={analysis.valence}
                  arousal={analysis.arousal}
                  confidence={analysis.confidence}
                  transcript={analysis.transcript}
                  isOwn={isOwn}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
