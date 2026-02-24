/**
 * MoodBadge - Displays emotion/mood analysis results
 *
 * Shows the detected mood with appropriate emoji and color:
 * - happy: 😊 Green
 * - sad: 😢 Blue
 * - angry: 😠 Red
 * - neutral: 😐 Gray
 * - excited: 🤩 Purple
 * - calm: 😌 Teal
 *
 * Supports valence/arousal display for more nuanced emotion visualization.
 *
 * @example
 * ```tsx
 * import { MoodBadge } from '@meerkat/ui';
 *
 * function VoiceMemoCard({ mood, valence, arousal }) {
 *   return (
 *     <div>
 *       <audio src="..." />
 *       <MoodBadge
 *         mood={mood}
 *         valence={valence}
 *         arousal={arousal}
 *         showValenceArousal
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoodLabel =
  | "happy"
  | "sad"
  | "angry"
  | "neutral"
  | "fear"
  | "surprise"
  | "disgust";

const moodConfig = {
  happy: {
    label: "Happy",
    emoji: "😊",
    color: "emerald",
  },
  sad: {
    label: "Sad",
    emoji: "😢",
    color: "blue",
  },
  angry: {
    label: "Angry",
    emoji: "😠",
    color: "red",
  },
  neutral: {
    label: "Neutral",
    emoji: "😐",
    color: "gray",
  },
  fear: {
    label: "Fearful",
    emoji: "😨",
    color: "purple",
  },
  surprise: {
    label: "Surprised",
    emoji: "😮",
    color: "yellow",
  },
  disgust: {
    label: "Disgusted",
    emoji: "😖",
    color: "orange",
  },
} as const;

// ─── Variants ─────────────────────────────────────────────────────────────────

const moodBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
  {
    variants: {
      mood: {
        happy:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        sad: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        angry: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        neutral:
          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        fear: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        surprise:
          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        disgust:
          "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5 gap-1",
        default: "text-xs px-2.5 py-1 gap-1.5",
        lg: "text-sm px-3 py-1.5 gap-2",
      },
    },
    defaultVariants: {
      mood: "neutral",
      size: "default",
    },
  },
);

// ─── Component ────────────────────────────────────────────────────────────────

export interface MoodBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof moodBadgeVariants> {
  /**
   * Detected mood/emotion
   */
  mood: MoodLabel;
  /**
   * Valence score (-1 to 1, negative to positive)
   * Optional, for more nuanced display
   */
  valence?: number;
  /**
   * Arousal score (0 to 1, calm to excited)
   * Optional, for more nuanced display
   */
  arousal?: number;
  /**
   * Show emoji
   * @default true
   */
  showEmoji?: boolean;
  /**
   * Show label text
   * @default true
   */
  showLabel?: boolean;
  /**
   * Show valence/arousal scores
   * @default false
   */
  showValenceArousal?: boolean;
  /**
   * Confidence score (0 to 1)
   * Shown as a subtle indicator
   */
  confidence?: number;
}

const MoodBadge = React.forwardRef<HTMLDivElement, MoodBadgeProps>(
  (
    {
      mood,
      valence,
      arousal,
      showEmoji = true,
      showLabel = true,
      showValenceArousal = false,
      confidence,
      size,
      className,
      ...props
    },
    ref,
  ) => {
    const config = moodConfig[mood];

    // Format valence/arousal for display
    const formattedValence =
      valence !== undefined
        ? `${valence >= 0 ? "+" : ""}${valence.toFixed(2)}`
        : null;
    const formattedArousal = arousal !== undefined ? arousal.toFixed(2) : null;

    // Construct tooltip text
    const tooltipParts: string[] = [config.label];
    if (confidence !== undefined) {
      tooltipParts.push(`(${Math.round(confidence * 100)}% confidence)`);
    }
    if (valence !== undefined && arousal !== undefined) {
      tooltipParts.push(
        `Valence: ${formattedValence}, Arousal: ${formattedArousal}`,
      );
    }
    const tooltip = tooltipParts.join(" ");

    return (
      <div
        ref={ref}
        className={cn(moodBadgeVariants({ mood, size }), className)}
        title={tooltip}
        role="status"
        aria-label={`Mood: ${config.label}`}
        {...props}
      >
        {showEmoji && (
          <span className="text-base leading-none" aria-hidden="true">
            {config.emoji}
          </span>
        )}
        {showLabel && <span>{config.label}</span>}
        {showValenceArousal && formattedValence && formattedArousal && (
          <span className="text-[10px] opacity-70 ml-0.5">
            ({formattedValence}, {formattedArousal})
          </span>
        )}
        {confidence !== undefined && confidence < 0.7 && (
          <span
            className="inline-block w-1 h-1 rounded-full bg-current opacity-40"
            title="Low confidence"
            aria-label="Low confidence indicator"
          />
        )}
      </div>
    );
  },
);

MoodBadge.displayName = "MoodBadge";

export { MoodBadge, moodBadgeVariants };
