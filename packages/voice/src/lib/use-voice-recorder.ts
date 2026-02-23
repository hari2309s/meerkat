// ─── use-voice-recorder.ts ───────────────────────────────────────────────────
//
// useVoiceRecorder — React hook for the full recording lifecycle.
//
// State machine:
//
//   idle ──► requesting ──► recording ──► stopping ──► preview ──► saving ──► done
//                │               │                          │          │
//                └───► error ◄───┘                          └──► error ◄┘
//
// Usage:
//
//   const { phase, seconds, audioUrl, start, stop, discard, save } = useVoiceRecorder()
//
//   // In JSX:
//   <button onClick={start}>Record</button>
//   <button onClick={stop}>Stop</button>
//   {audioUrl && <audio src={audioUrl} controls />}
//   <button onClick={() => save(denId, key)}>Save</button>

import { useState, useRef, useCallback, useEffect } from "react";
import { saveVoiceNote } from "./save";
import type {
  RecorderState,
  UseVoiceRecorderReturn,
  SavedVoiceNote,
  SaveVoiceNoteOptions,
} from "../types.js";

// Prefer webm (Chromium) then ogg (Firefox) then fallback to browser default
function getBestMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "",
  ];
  for (const mime of candidates) {
    if (!mime || MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

const INITIAL_STATE: RecorderState = {
  phase: "idle",
  seconds: 0,
  audioBlob: null,
  audioUrl: null,
  errorMessage: null,
};

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecorderState>(INITIAL_STATE);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Store the resolveStop fn so we can await onstop
  const resolveStopRef = useRef<((blob: Blob) => void) | null>(null);

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── start ────────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    setState({ ...INITIAL_STATE, phase: "requesting" });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Whisper prefers 16kHz
        },
      });

      streamRef.current = stream;

      const mimeType = getBestMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);

        setState((prev) => ({
          ...prev,
          phase: "preview",
          audioBlob: blob,
          audioUrl: url,
        }));

        resolveStopRef.current?.(blob);
        resolveStopRef.current = null;

        cleanup();
      };

      mr.start(100); // collect data every 100ms

      setState((prev) => ({
        ...prev,
        phase: "recording",
        seconds: 0,
      }));

      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, seconds: prev.seconds + 1 }));
      }, 1000);
    } catch (err) {
      cleanup();
      setState({
        ...INITIAL_STATE,
        phase: "error",
        errorMessage:
          err instanceof Error && err.name === "NotAllowedError"
            ? "Microphone access denied. Please allow microphone access in your browser settings."
            : `Could not start recording: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }, [cleanup]);

  // ── stop ─────────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === "inactive") return;

    setState((prev) => ({ ...prev, phase: "stopping" }));
    mediaRecorderRef.current.stop();
  }, []);

  // ── discard ──────────────────────────────────────────────────────────────────

  const discard = useCallback(() => {
    cleanup();
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    setState(INITIAL_STATE);
  }, [cleanup, state.audioUrl]);

  // ── save ─────────────────────────────────────────────────────────────────────

  const save = useCallback(
    async (
      denId: string,
      encryptionKey: CryptoKey,
      uploadFn?: SaveVoiceNoteOptions["uploadEncryptedBlob"],
    ): Promise<SavedVoiceNote> => {
      if (!state.audioBlob) {
        throw new Error("[@meerkat/voice] No audio blob to save.");
      }

      setState((prev) => ({ ...prev, phase: "saving" }));

      // Default upload function — callers should override in production
      const uploadEncryptedBlob: SaveVoiceNoteOptions["uploadEncryptedBlob"] =
        uploadFn ??
        (() => {
          throw new Error(
            "[@meerkat/voice] uploadEncryptedBlob must be provided to save(). " +
              "Pass it as the third argument or use saveVoiceNote() directly.",
          );
        });

      try {
        const result = await saveVoiceNote(state.audioBlob, state.seconds, {
          denId,
          encryptionKey,
          uploadEncryptedBlob,
        });

        setState((prev) => ({ ...prev, phase: "done" }));
        return result;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          phase: "error",
          errorMessage: `Failed to save voice note: ${err instanceof Error ? err.message : String(err)}`,
        }));
        throw err;
      }
    },
    [state.audioBlob, state.seconds],
  );

  return {
    ...state,
    start,
    stop,
    discard,
    save,
  };
}
