"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, Square, Send, X, Loader2 } from "lucide-react";
import { ModalShell } from "@/components/ui/modal-shell";
import { useChatStore } from "@/stores/use-chat-store";

interface VoiceNoteRecorderProps {
  onClose: () => void;
  onSend: (blob: Blob, durationSeconds: number) => Promise<void>;
}

export function VoiceNoteRecorder({ onClose, onSend }: VoiceNoteRecorderProps) {
  const [phase, setPhase] = useState<
    "idle" | "recording" | "preview" | "sending"
  >("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setIsRecording } = useChatStore();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setPhase("preview");
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(100);
      setPhase("recording");
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    setPhase("sending");
    try {
      await onSend(audioBlob, seconds);
      onClose();
    } catch {
      setError("Failed to send voice note. Please try again.");
      setPhase("preview");
    }
  };

  const handleDiscard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setSeconds(0);
    setPhase("idle");
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-sm">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(212,103,58,0.12)" }}
        >
          <Mic className="h-4 w-4" style={{ color: "#d4673a" }} />
        </div>
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Voice message
          </h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {phase === "idle" && "Tap to start recording"}
            {phase === "recording" && "Recording…"}
            {phase === "preview" && "Review before sending"}
            {phase === "sending" && "Sending…"}
          </p>
        </div>
      </div>

      {/* Waveform / timer */}
      <div
        className="rounded-2xl p-6 mb-4 flex flex-col items-center justify-center gap-4"
        style={{
          background: "var(--color-btn-secondary-bg)",
          border: "1.5px solid var(--color-border-card)",
          minHeight: 120,
        }}
      >
        {phase === "recording" && (
          <>
            {/* Animated waveform bars */}
            <div className="flex items-end gap-1 h-10">
              {Array.from({ length: 18 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 rounded-full"
                  style={{ background: "#d4673a" }}
                  animate={{ height: [6, Math.random() * 32 + 4, 6] }}
                  transition={{
                    duration: 0.5 + Math.random() * 0.4,
                    repeat: Infinity,
                    delay: i * 0.04,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: "var(--color-text-primary)" }}
            >
              {formatTime(seconds)}
            </span>
          </>
        )}
        {phase === "idle" && (
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(212,103,58,0.1)" }}
          >
            <Mic className="h-7 w-7" style={{ color: "#d4673a" }} />
          </div>
        )}
        {(phase === "preview" || phase === "sending") && audioUrl && (
          <>
            <audio src={audioUrl} controls className="w-full rounded-xl" />
            <span
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatTime(seconds)} recorded
            </span>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs mb-3" style={{ color: "#e07050" }}>
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {phase === "idle" && (
          <>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--color-btn-secondary-bg)",
                color: "var(--color-btn-secondary-text)",
              }}
            >
              Cancel
            </button>
            <motion.button
              onClick={startRecording}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{
                background: "#d4673a",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(212,103,58,0.4)",
              }}
            >
              <Mic className="h-4 w-4" />
              Start recording
            </motion.button>
          </>
        )}

        {phase === "recording" && (
          <motion.button
            onClick={stopRecording}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{
              background: "#e05c4a",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(224,92,74,0.4)",
            }}
          >
            <Square className="h-4 w-4 fill-current" />
            Stop
          </motion.button>
        )}

        {phase === "preview" && (
          <>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--color-btn-secondary-bg)",
                color: "var(--color-btn-secondary-text)",
              }}
            >
              <X className="h-3.5 w-3.5" />
              Discard
            </button>
            <motion.button
              onClick={handleSend}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{
                background: "var(--color-btn-default-bg)",
                color: "var(--color-btn-default-text)",
                boxShadow: "0 4px 16px var(--color-btn-default-shadow)",
              }}
            >
              <Send className="h-4 w-4" />
              Send
            </motion.button>
          </>
        )}

        {phase === "sending" && (
          <div
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{
              background: "var(--color-btn-secondary-bg)",
              color: "var(--color-text-muted)",
            }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </div>
        )}
      </div>
    </ModalShell>
  );
}
