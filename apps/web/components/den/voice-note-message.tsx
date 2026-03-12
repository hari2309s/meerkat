"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getInitials, getSenderName } from "@meerkat/utils/string";
import type { Message, MoodLabel, ToneLabel } from "@/types/den";
import { useVoiceUrl } from "@/hooks/use-voice-url";
import { VoicePlayerCard } from "@/components/voice-player-card";

// ─── Mood colour map ──────────────────────────────────────────────────────────

const MOOD_COLOR: Record<MoodLabel, string> = {
  positive: "#FBBF24",
  negative: "#60A5FA",
  neutral: "#94A3B8",
};

const MOOD_EMOJI: Record<MoodLabel, string> = {
  positive: "😊",
  negative: "😔",
  neutral: "😐",
};

// Mood → human-readable label.
const MOOD_TEXT_LABEL: Record<MoodLabel, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

// Tone → human-readable label.
const TONE_DISPLAY_LABEL: Record<ToneLabel, string> = {
  energetic: "Energetic",
  tense: "Tense",
  animated: "Animated",
  calm: "Calm",
  subdued: "Subdued",
  monotone: "Monotone",
  pleasant: "Pleasant",
  serious: "Serious",
  conversational: "Conversational",
};

// ─── Compact mood side panel (detail content only) ───────────────────────────

interface MoodSidePanelProps {
  mood: MoodLabel;
  tone?: ToneLabel;
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
  const pct = Math.round(confidence * 100);
  // Show "Mood · Tone · confidence%" — tone is shown alongside mood so the
  // user sees both the valence (positive/negative/neutral) and the qualitative
  // delivery (subdued/energetic/tense…). Fall back to mood-only for neutral.
  const toneLabel = tone ? TONE_DISPLAY_LABEL[tone] : null;
  const displayLabel =
    mood !== "neutral" && toneLabel
      ? `${MOOD_TEXT_LABEL[mood]} · ${toneLabel}`
      : (toneLabel ?? MOOD_TEXT_LABEL[mood]);
  const valencePct = Math.round(((valence + 1) / 2) * 100);
  const arousalPct = Math.round(arousal * 100);

  return (
    <div
      className={`flex flex-col gap-2 shrink-0 ${isOwn ? "items-end" : "items-start"}`}
    >
      {/* Tone · confidence label */}
      <div
        className="text-[10px] font-semibold leading-none px-0.5"
        style={{ color: "var(--color-text-muted)" }}
      >
        {displayLabel} · {pct}%
      </div>

      {/* Bars + transcript side by side — transcript leads on own messages */}
      <div
        className={`flex gap-2 items-start ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      >
        {/* Compact valence / arousal bars */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span
              className="text-[9px] w-8 shrink-0 leading-none"
              style={{ color: "var(--color-text-muted)" }}
            >
              Mood
            </span>
            <div
              className="w-10 h-1 rounded-full overflow-hidden"
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
              className="w-10 h-1 rounded-full overflow-hidden"
              style={{ background: "var(--color-btn-secondary-bg)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${arousalPct}%`, background: color }}
              />
            </div>
          </div>
        </div>

        {/* Transcript — sits beside the bars */}
        {transcript && (
          <p
            className="text-[10px] italic leading-relaxed line-clamp-3"
            style={{ color: "var(--color-text-primary)", opacity: 0.75 }}
          >
            &ldquo;{transcript}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface VoiceNoteMessageProps {
  message: Message;
  isOwn: boolean;
  /** When true, the mood accordion starts open. Defaults to false. */
  isLatest?: boolean;
}

export function VoiceNoteMessage({
  message,
  isOwn,
  isLatest = false,
}: VoiceNoteMessageProps) {
  const [moodExpanded, setMoodExpanded] = useState(isLatest);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss the panel after 10 s when it opens.
  // Clicking the emoji button toggles it manually and resets the timer.
  useEffect(() => {
    if (!moodExpanded) return;
    dismissTimer.current = setTimeout(() => setMoodExpanded(false), 10000);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [moodExpanded]);

  const displayName = getSenderName(message.sender);
  const initialsSource =
    message.sender?.full_name || message.sender?.email || "Unknown";

  const { analysis } = message;
  const moodColor = analysis ? MOOD_COLOR[analysis.mood] : null;
  const moodEmoji = analysis ? MOOD_EMOJI[analysis.mood] : null;
  const { url: signedUrl, isDecrypting } = useVoiceUrl(message.voice_url);

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

        <VoicePlayerCard
          src={signedUrl}
          isLoading={isDecrypting}
          duration={duration}
          createdAt={message.created_at}
          isOwn={isOwn}
        />
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
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                style={{
                  transformOrigin: isOwn ? "right center" : "left center",
                }}
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
