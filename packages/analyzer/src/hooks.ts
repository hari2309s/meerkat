/**
 * @meerkat/analyzer — React hooks
 *
 * Hooks that integrate the analyzer into React components.
 *
 * These are optional — the imperative API (analyzeVoice, preloadModels, etc.)
 * works independently of React. Use these hooks in components that need to
 * react to model loading state or trigger analysis from UI events.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  analyzeVoice,
  preloadModels,
  getModelStatus,
  onModelStatusChange,
} from "./analyzer";
import type {
  AnalysisResult,
  AnalyzerOptions,
  ModelStatus,
  ModelProgressEvent,
} from "./types";

// ─── useModelStatus ───────────────────────────────────────────────────────────

/**
 * Returns the current load status of both analyzer models.
 * Reactively updates when either model's status changes.
 *
 * @example
 * ```tsx
 * function ModelStatusBadge() {
 *   const { transcription, emotion } = useModelStatus();
 *
 *   if (transcription === "loading" || emotion === "loading") {
 *     return <span>Downloading AI models…</span>;
 *   }
 *   if (transcription === "ready" && emotion === "ready") {
 *     return <span>On-device AI ready ✓</span>;
 *   }
 *   return null;
 * }
 * ```
 */
export function useModelStatus(): ModelStatus {
  const [status, setStatus] = useState<ModelStatus>(getModelStatus);

  useEffect(() => {
    // Subscribe to future changes.
    const unsubscribe = onModelStatusChange(setStatus);
    // Sync with current state in case it changed between render and effect.
    setStatus(getModelStatus());
    return unsubscribe;
  }, []);

  return status;
}

// ─── usePreloadModels ─────────────────────────────────────────────────────────

/**
 * Hook that preloads both analyzer models on mount with progress tracking.
 *
 * Returns { progress, isReady, error } so the UI can show a one-time
 * "downloading AI models" progress indicator.
 *
 * Calling this multiple times is safe — the underlying loader is idempotent.
 *
 * @example
 * ```tsx
 * function AppBootstrap() {
 *   const { progress, isReady } = usePreloadModels();
 *
 *   if (!isReady) {
 *     return <ModelDownloadProgress progress={progress} />;
 *   }
 *   return <App />;
 * }
 * ```
 */
export function usePreloadModels(): {
  events: ModelProgressEvent[];
  isReady: boolean;
  error: Error | null;
} {
  const [events, setEvents] = useState<ModelProgressEvent[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const onProgress = (event: ModelProgressEvent) => {
      if (!cancelled) {
        setEvents((prev) => [...prev, event]);
      }
    };

    preloadModels({ onProgress })
      .then(() => {
        if (!cancelled) setIsReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { events, isReady, error };
}

// ─── useAnalyzeVoice ──────────────────────────────────────────────────────────

/**
 * Returns a stable analyze function and its current state.
 *
 * The analysis runs asynchronously — call `analyze(blob)` and the hook
 * updates `result` when complete.
 *
 * @example
 * ```tsx
 * function VoiceNoteControls({ blob }: { blob: Blob }) {
 *   const { analyze, result, isAnalyzing, error } = useAnalyzeVoice();
 *
 *   return (
 *     <div>
 *       <button onClick={() => analyze(blob)} disabled={isAnalyzing}>
 *         {isAnalyzing ? "Analysing…" : "Analyse"}
 *       </button>
 *       {result && <MoodBadge mood={result.mood} confidence={result.confidence} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnalyzeVoice(options?: AnalyzerOptions): {
  analyze: (blob: Blob) => Promise<AnalysisResult>;
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  error: Error | null;
  reset: () => void;
} {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    abortRef.current = false;
    return () => {
      abortRef.current = true;
    };
  }, []);

  const analyze = useCallback(
    async (blob: Blob): Promise<AnalysisResult> => {
      setIsAnalyzing(true);
      setError(null);

      try {
        const analysisResult = await analyzeVoice(blob, options ?? {});
        if (!abortRef.current) {
          setResult(analysisResult);
        }
        return analysisResult;
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err));
        if (!abortRef.current) {
          setError(wrapped);
        }
        throw wrapped;
      } finally {
        if (!abortRef.current) {
          setIsAnalyzing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options?.language],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  return { analyze, result, isAnalyzing, error, reset };
}
