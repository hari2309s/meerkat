/**
 * VoiceRecorderButton - Voice recording button with visual feedback
 *
 * Shows different states:
 * - idle: Microphone icon, ready to record
 * - recording: Pulsing red dot, elapsed time
 * - preview: Play icon, waveform visualization (optional)
 * - saving: Spinner, progress indication
 *
 * Supports waveform visualization during recording.
 *
 * @example
 * ```tsx
 * import { VoiceRecorderButton } from '@meerkat/ui';
 *
 * function ChatInput() {
 *   const [phase, setPhase] = useState('idle');
 *   const [elapsed, setElapsed] = useState(0);
 *
 *   return (
 *     <VoiceRecorderButton
 *       phase={phase}
 *       elapsedSeconds={elapsed}
 *       onStart={() => setPhase('recording')}
 *       onStop={() => setPhase('preview')}
 *       onSave={() => setPhase('saving')}
 *     />
 *   );
 * }
 * ```
 */

import * as React from "react";
import { Mic, Square, Play, Pause, Check, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { Button } from "./button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceRecorderPhase = "idle" | "recording" | "preview" | "saving";

// ─── Component ────────────────────────────────────────────────────────────────

export interface VoiceRecorderButtonProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onError"
> {
  /**
   * Current recording phase
   */
  phase: VoiceRecorderPhase;
  /**
   * Elapsed recording time in seconds
   */
  elapsedSeconds?: number;
  /**
   * Audio blob URL for preview playback
   */
  audioUrl?: string;
  /**
   * Whether audio is currently playing in preview
   */
  isPlaying?: boolean;
  /**
   * Waveform data points (0-1 range)
   * Optional, for visualization during recording
   */
  waveform?: number[];
  /**
   * Callback when start recording is clicked
   */
  onStart?: () => void;
  /**
   * Callback when stop recording is clicked
   */
  onStop?: () => void;
  /**
   * Callback when play/pause is clicked (preview phase)
   */
  onPlayPause?: () => void;
  /**
   * Callback when save is clicked
   */
  onSave?: () => void;
  /**
   * Callback when cancel is clicked
   */
  onCancel?: () => void;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
}

const VoiceRecorderButton = React.forwardRef<
  HTMLDivElement,
  VoiceRecorderButtonProps
>(
  (
    {
      phase,
      elapsedSeconds = 0,
      audioUrl,
      isPlaying = false,
      waveform,
      onStart,
      onStop,
      onPlayPause,
      onSave,
      onCancel,
      error,
      disabled,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center gap-3", className)}
        {...props}
      >
        {/* Main button area */}
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <IdleButton onStart={onStart} disabled={disabled} />
          )}
          {phase === "recording" && (
            <RecordingButton
              elapsedSeconds={elapsedSeconds}
              waveform={waveform}
              onStop={onStop}
            />
          )}
          {phase === "preview" && (
            <PreviewControls
              isPlaying={isPlaying}
              onPlayPause={onPlayPause}
              onSave={onSave}
              onCancel={onCancel}
              disabled={disabled}
            />
          )}
          {phase === "saving" && <SavingIndicator />}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  },
);

VoiceRecorderButton.displayName = "VoiceRecorderButton";

// ─── IdleButton ───────────────────────────────────────────────────────────────

interface IdleButtonProps {
  onStart?: () => void;
  disabled?: boolean;
}

function IdleButton({ onStart, disabled }: IdleButtonProps) {
  return (
    <motion.div
      key="idle"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Button
        size="lg"
        onClick={onStart}
        disabled={disabled}
        className="rounded-full h-16 w-16 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all"
        aria-label="Start recording"
      >
        <Mic size={24} />
      </Button>
    </motion.div>
  );
}

// ─── RecordingButton ──────────────────────────────────────────────────────────

interface RecordingButtonProps {
  elapsedSeconds: number;
  waveform?: number[];
  onStop?: () => void;
}

function RecordingButton({
  elapsedSeconds,
  waveform,
  onStop,
}: RecordingButtonProps) {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <motion.div
      key="recording"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="flex flex-col items-center gap-3"
    >
      {/* Pulsing record button */}
      <motion.div className="relative">
        <Button
          size="lg"
          onClick={onStop}
          className="rounded-full h-16 w-16 bg-red-600 hover:bg-red-700 text-white shadow-lg"
          aria-label="Stop recording"
        >
          <Square size={20} fill="currentColor" />
        </Button>
        {/* Pulse animation */}
        <motion.div
          className="absolute inset-0 rounded-full bg-red-600 opacity-30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      {/* Timer */}
      <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
        {timeString}
      </div>

      {/* Waveform visualization */}
      {waveform && waveform.length > 0 && (
        <div className="flex items-center gap-0.5 h-8">
          {waveform.slice(-30).map((value, i) => (
            <motion.div
              key={i}
              className="w-1 bg-red-600 rounded-full"
              style={{ height: `${Math.max(value * 100, 4)}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.1 }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── PreviewControls ──────────────────────────────────────────────────────────

interface PreviewControlsProps {
  isPlaying: boolean;
  onPlayPause?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
}

function PreviewControls({
  isPlaying,
  onPlayPause,
  onSave,
  onCancel,
  disabled,
}: PreviewControlsProps) {
  return (
    <motion.div
      key="preview"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="flex items-center gap-3"
    >
      {/* Cancel button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={onCancel}
        disabled={disabled}
        className="h-12 w-12 rounded-full text-gray-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        aria-label="Cancel recording"
      >
        <X size={20} />
      </Button>

      {/* Play/Pause button */}
      <Button
        size="lg"
        onClick={onPlayPause}
        disabled={disabled}
        className="rounded-full h-16 w-16 bg-gray-700 hover:bg-gray-800 text-white shadow-lg"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
      </Button>

      {/* Save button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={onSave}
        disabled={disabled}
        className="h-12 w-12 rounded-full text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
        aria-label="Save recording"
      >
        <Check size={20} />
      </Button>
    </motion.div>
  );
}

// ─── SavingIndicator ──────────────────────────────────────────────────────────

function SavingIndicator() {
  return (
    <motion.div
      key="saving"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
        <Loader2 size={24} className="animate-spin" />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">Saving...</p>
    </motion.div>
  );
}

export { VoiceRecorderButton };
