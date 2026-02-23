/**
 * @meerkat/analyzer — integration tests
 *
 * Tests the full analyzeVoice() pipeline with transformers.js mocked out.
 *
 * We cannot run real Whisper or ONNX inference in vitest (no browser WASM
 * environment), so we mock the model-registry module and verify that
 * analyzeVoice() correctly orchestrates transcription → classification → result.
 *
 * The pure utils and label-mapping logic is tested separately in utils.test.ts
 * where no mocking is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock model-registry before importing anything else ───────────────────────

vi.mock("../lib/model-registry", () => {
  let _transcriptionStatus = "idle";
  let _emotionStatus = "idle";
  const listeners = new Set<
    (s: { transcription: string; emotion: string }) => void
  >();

  return {
    getTranscriptionPipeline: vi.fn(),
    getEmotionPipeline: vi.fn(),
    isModelLoaded: vi.fn(
      () => _transcriptionStatus === "ready" && _emotionStatus === "ready",
    ),
    getModelStatus: vi.fn(() => ({
      transcription: _transcriptionStatus,
      emotion: _emotionStatus,
    })),
    onModelStatusChange: vi.fn(
      (fn: (s: { transcription: string; emotion: string }) => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    ),
    resetModels: vi.fn(() => {
      _transcriptionStatus = "idle";
      _emotionStatus = "idle";
    }),
  };
});

// ─── Also mock blobToFloat32 so we don't need AudioContext ────────────────────

vi.mock("../utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("../utils")>();
  return {
    ...original,
    blobToFloat32: vi.fn(async () => new Float32Array(1600).fill(0.05)),
    isSilent: vi.fn(() => false),
  };
});

import {
  getTranscriptionPipeline,
  getEmotionPipeline,
} from "../lib/model-registry";
import {
  analyzeVoice,
  classifyEmotion,
  transcribe,
  preloadModels,
} from "../analyzer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a mock Whisper pipeline that returns a fixed transcript. */
function makeTranscriptionMock(text: string) {
  return vi.fn().mockResolvedValue({ text });
}

/** Builds a mock emotion pipeline that returns a fixed classification. */
function makeEmotionMock(label: string, score: number) {
  return vi.fn().mockResolvedValue([{ label, score }]);
}

// ─── analyzeVoice ─────────────────────────────────────────────────────────────

describe("analyzeVoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a complete AnalysisResult for a happy transcript", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("I'm feeling really great today!") as never,
    );
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("joy", 0.93) as never,
    );

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await analyzeVoice(blob, { language: "en" });

    expect(result.transcript).toBe("I'm feeling really great today!");
    expect(result.mood).toBe("happy"); // "joy" → "happy"
    expect(result.valence).toBeGreaterThan(0);
    expect(result.arousal).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.analysedAt).toBeGreaterThan(0);
    expect(typeof result.tone).toBe("string");
  });

  it("maps sad label correctly", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("I don't feel like doing anything today.") as never,
    );
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("sadness", 0.88) as never,
    );

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await analyzeVoice(blob);

    expect(result.mood).toBe("sad");
    expect(result.valence).toBeLessThan(0);
  });

  it("returns neutral result when transcript is empty", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("") as never,
    );
    // Emotion pipeline should NOT be called when transcript is empty.
    const emotionMock = makeEmotionMock("neutral", 0.5);
    vi.mocked(getEmotionPipeline).mockResolvedValue(emotionMock as never);

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await analyzeVoice(blob);

    expect(result.transcript).toBe("");
    expect(result.mood).toBe("neutral");
    expect(result.valence).toBe(0);
    expect(result.arousal).toBe(0);
    expect(result.confidence).toBe(0);
    // Emotion pipeline should not be called for empty transcripts.
    expect(emotionMock).not.toHaveBeenCalled();
  });

  it("includes analysedAt timestamp", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("Quick test.") as never,
    );
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("neutral", 0.7) as never,
    );

    const before = Date.now();
    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await analyzeVoice(blob);
    const after = Date.now();

    expect(result.analysedAt).toBeGreaterThanOrEqual(before);
    expect(result.analysedAt).toBeLessThanOrEqual(after);
  });
});

// ─── classifyEmotion ─────────────────────────────────────────────────────────

describe("classifyEmotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for text that is too short", async () => {
    const result = await classifyEmotion("ok");
    expect(result).toBeNull();
    expect(getEmotionPipeline).not.toHaveBeenCalled();
  });

  it("returns null for empty string", async () => {
    const result = await classifyEmotion("");
    expect(result).toBeNull();
  });

  it("classifies a happy sentence", async () => {
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("happy", 0.95) as never,
    );

    const result = await classifyEmotion("I am absolutely thrilled!");
    expect(result).not.toBeNull();
    expect(result!.mood).toBe("happy");
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it("handles nested array output from some pipeline versions", async () => {
    // Some versions of transformers.js wrap results in a double array.
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      vi.fn().mockResolvedValue([[{ label: "joy", score: 0.9 }]]) as never,
    );

    const result = await classifyEmotion("This is wonderful news!");
    expect(result!.mood).toBe("happy");
  });
});

// ─── transcribe ───────────────────────────────────────────────────────────────

describe("transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trimmed transcript text", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("  Hello world.  ") as never,
    );

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const text = await transcribe(blob);
    expect(text).toBe("Hello world.");
  });

  it("returns empty string for silent audio", async () => {
    // Override isSilent to return true for this test.
    const { isSilent } = await import("../utils");
    vi.mocked(isSilent).mockReturnValueOnce(true);

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const text = await transcribe(blob);
    expect(text).toBe("");
    expect(getTranscriptionPipeline).not.toHaveBeenCalled();
  });
});

// ─── preloadModels ────────────────────────────────────────────────────────────

describe("preloadModels", () => {
  it("calls both pipeline loaders", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("") as never,
    );
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("neutral", 0.5) as never,
    );

    await preloadModels();

    expect(getTranscriptionPipeline).toHaveBeenCalled();
    expect(getEmotionPipeline).toHaveBeenCalled();
  });

  it("passes onProgress to both pipelines", async () => {
    const mockTransPipe = makeTranscriptionMock("");
    const mockEmotionPipe = makeEmotionMock("neutral", 0.5);
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      mockTransPipe as never,
    );
    vi.mocked(getEmotionPipeline).mockResolvedValue(mockEmotionPipe as never);

    const onProgress = vi.fn();
    await preloadModels({ onProgress });

    expect(getTranscriptionPipeline).toHaveBeenCalledWith(onProgress);
    expect(getEmotionPipeline).toHaveBeenCalledWith(onProgress);
  });
});
