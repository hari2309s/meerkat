// ─── use-voice-player.ts ─────────────────────────────────────────────────────
//
// useVoicePlayer — React hook for playing back encrypted voice memos.
//
// The caller is responsible for providing either:
//   (a) a pre-resolved audioUrl (for preview of a fresh recording), or
//   (b) a fetchUrl function that retrieves and decrypts the blob from storage.
//
// Usage (preview mode — freshly recorded):
//
//   const player = useVoicePlayer({ audioUrl: recorderState.audioUrl })
//
// Usage (stored memo — needs decryption):
//
//   const player = useVoicePlayer({
//     fetchUrl: async () => {
//       const encrypted = await trpc.voice.getUrl.query({ blobRef })
//       const bytes = await decryptBlob(encrypted, namespaceKey)
//       const blob = new Blob([bytes], { type: 'audio/webm' })
//       return URL.createObjectURL(blob)
//     }
//   })

import { useState, useRef, useCallback, useEffect } from "react";
import type { PlayerState, UseVoicePlayerReturn } from "../types";

interface UseVoicePlayerOptions {
  /** A ready-to-use URL (e.g. from URL.createObjectURL). */
  audioUrl?: string | null;
  /**
   * An async function that returns an object URL.
   * Called once on mount. The URL it returns is revoked on unmount.
   */
  fetchUrl?: () => Promise<string>;
}

const INITIAL_PLAYER_STATE: PlayerState = {
  isPlaying: false,
  currentSeconds: 0,
  durationSeconds: 0,
  progress: 0,
  isLoading: false,
  error: null,
};

export function useVoicePlayer(
  options: UseVoicePlayerOptions,
): UseVoicePlayerReturn {
  const [state, setState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvedUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // ── Setup audio element ───────────────────────────────────────────────────

  const initAudio = useCallback((url: string) => {
    // Clean up any previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setState((prev) => ({
        ...prev,
        durationSeconds: audio.duration,
        isLoading: false,
      }));
    };

    audio.onended = () => {
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        currentSeconds: 0,
        progress: 0,
      }));
      audio.currentTime = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    audio.onerror = () => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to load audio.",
      }));
    };
  }, []);

  // ── Load source ───────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      if (options.audioUrl) {
        initAudio(options.audioUrl);
        return;
      }

      if (options.fetchUrl) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        try {
          const url = await options.fetchUrl();
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          resolvedUrlRef.current = url;
          initAudio(url);
        } catch (err) {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error: `Could not load audio: ${err instanceof Error ? err.message : String(err)}`,
            }));
          }
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.audioUrl, options.fetchUrl]);

  // ── Progress tracking (rAF loop) ──────────────────────────────────────────

  const startProgressTracking = useCallback(() => {
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const current = audio.currentTime;
      const duration = audio.duration || 0;
      setState((prev) => ({
        ...prev,
        currentSeconds: current,
        progress: duration > 0 ? current / duration : 0,
      }));
      if (!audio.paused) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Controls ──────────────────────────────────────────────────────────────

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => {
        setState((prev) => ({ ...prev, isPlaying: true }));
        startProgressTracking();
      })
      .catch((err) => {
        setState((prev) => ({
          ...prev,
          error: `Playback failed: ${err instanceof Error ? err.message : String(err)}`,
        }));
      });
  }, [startProgressTracking]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setState((prev) => ({ ...prev, isPlaying: false }));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || 0));
    setState((prev) => ({
      ...prev,
      currentSeconds: audio.currentTime,
      progress: audio.duration > 0 ? audio.currentTime / audio.duration : 0,
    }));
  }, []);

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  return {
    ...state,
    play,
    pause,
    seek,
    togglePlayPause,
  };
}
