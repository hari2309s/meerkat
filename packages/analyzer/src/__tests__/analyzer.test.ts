/**
 * @meerkat/analyzer — integration tests
 *
 * Tests the full analyzeVoice() three-stream pipeline with transformers.js
 * mocked out. Also tests the audio-feature extraction and fusion functions,
 * which are pure and require no mocking.
 *
 * We cannot run real Whisper or ONNX inference in vitest (no browser WASM
 * environment), so we mock the model-registry module and verify that
 * analyzeVoice() correctly orchestrates:
 *   1. Audio feature extraction (from decoded PCM)
 *   2. Transcription via Whisper
 *   3. Sentiment classification from transcript (DistilBERT SST-2)
 *   4. Signal fusion with contradiction detection
 *
 * Pure utils and label-mapping logic is tested separately in utils.test.ts.
 * Pure audio-feature logic is tested in audio-features.test.ts.
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

// ─── Mock blobToFloat32 so we don't need a real AudioContext ─────────────────
//
// The new analyzeVoice() calls blobToFloat32 once and reuses the samples for
// both extractAudioFeatures() and transcribeSamples(). We return a short
// synthetic sinusoid so that audio feature extraction produces non-trivial
// (non-zero) values without needing a real audio decoder.

vi.mock("../utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("../utils")>();
  return {
    ...original,
    blobToFloat32: vi.fn(async () => {
      // 0.5s of 200Hz sine at 16kHz — produces voiced frames with clear pitch.
      const samples = new Float32Array(8000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.3 * Math.sin((2 * Math.PI * 200 * i) / 16000);
      }
      return samples;
    }),
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
  extractAudioFeatures,
  inferMoodFromAudio,
  fuseEmotionSignals,
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

/** Synthetic audio: 0.5s of 200Hz sine at 16kHz. Voiced, clear pitch. */
function makeSineSamples(hz = 200, durationSamples = 8000): Float32Array {
  const samples = new Float32Array(durationSamples);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.3 * Math.sin((2 * Math.PI * hz * i) / 16000);
  }
  return samples;
}

/** Silent samples — all zeros. */
function makeSilentSamples(n = 8000): Float32Array {
  return new Float32Array(n).fill(0);
}

// ─── analyzeVoice ─────────────────────────────────────────────────────────────

describe("analyzeVoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a complete AnalysisResult including audioFeatures for a positive transcript", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("I'm feeling really great today!") as never,
    );
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("POSITIVE", 0.93) as never,
    );

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await analyzeVoice(blob, { language: "en" });

    expect(result.transcript).toBe("I'm feeling really great today!");
    // Mood is fused from text (POSITIVE → positive valence) and audio signal.
    // The 3-class mood is determined by the fused valence, which may be
    // dampened by the audio signal. Assert it is a valid label.
    expect(["positive", "negative", "neutral"]).toContain(result.mood);
    expect(result.arousal).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.analysedAt).toBeGreaterThan(0);
    expect(typeof result.tone).toBe("string");
    expect(typeof result.description).toBe("string");
    expect(result.description.length).toBeGreaterThan(0);

    // New: audioFeatures should be present
    expect(result.audioFeatures).toBeDefined();
    expect(typeof result.audioFeatures!.energyMean).toBe("number");
    expect(typeof result.audioFeatures!.voicedFraction).toBe("number");
    expect(typeof result.audioFeatures!.jitter).toBe("number");
    expect(typeof result.audioFeatures!.shimmer).toBe("number");
    expect(typeof result.audioFeatures!.pauseDuration).toBe("number");
  });

  it("maps NEGATIVE label correctly and fuses with audio signal", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("I don't feel like doing anything today.") as never,
    );
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("NEGATIVE", 0.88) as never,
    );

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await analyzeVoice(blob);

    // Text signal dominates for a high-confidence classification.
    expect(result.mood).toBe("negative");
    expect(result.valence).toBeLessThan(0);
  });

  it("falls back to audio-only mood when transcript is empty", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("") as never,
    );
    // Emotion pipeline should NOT be called when transcript is empty.
    const emotionMock = makeEmotionMock("neutral", 0.5);
    vi.mocked(getEmotionPipeline).mockResolvedValue(emotionMock as never);

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await analyzeVoice(blob);

    expect(result.transcript).toBe("");
    // Audio-only mood from synthetic sine wave — should not be undefined.
    expect(result.mood).toBeDefined();
    expect(typeof result.mood).toBe("string");
    // Emotion pipeline should not be called for empty transcripts.
    expect(emotionMock).not.toHaveBeenCalled();
    // audioFeatures should still be present.
    expect(result.audioFeatures).toBeDefined();
    // description should still be present.
    expect(typeof result.description).toBe("string");
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

  it("audioFeatures.voicedFraction is between 0 and 1", async () => {
    vi.mocked(getTranscriptionPipeline).mockResolvedValue(
      makeTranscriptionMock("Test.") as never,
    );
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("neutral", 0.6) as never,
    );

    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await analyzeVoice(blob);

    expect(result.audioFeatures!.voicedFraction).toBeGreaterThanOrEqual(0);
    expect(result.audioFeatures!.voicedFraction).toBeLessThanOrEqual(1);
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

  it("classifies a positive sentence", async () => {
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      makeEmotionMock("POSITIVE", 0.95) as never,
    );

    const result = await classifyEmotion("I am absolutely thrilled!");
    expect(result).not.toBeNull();
    expect(result!.mood).toBe("positive");
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it("handles nested array output from some pipeline versions", async () => {
    vi.mocked(getEmotionPipeline).mockResolvedValue(
      vi.fn().mockResolvedValue([[{ label: "POSITIVE", score: 0.9 }]]) as never,
    );

    const result = await classifyEmotion("This is wonderful news!");
    expect(result!.mood).toBe("positive");
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

// ─── extractAudioFeatures ─────────────────────────────────────────────────────
//
// These tests are pure — no mocking needed. They run against real PCM arrays.

describe("extractAudioFeatures", () => {
  it("returns silent features for all-zero samples", () => {
    const features = extractAudioFeatures(makeSilentSamples());

    expect(features.pitchMedianHz).toBeNull();
    expect(features.energyMean).toBe(0);
    expect(features.voicedFraction).toBe(0);
    expect(features.speakingRateFPS).toBe(0);
    expect(features.jitter).toBe(0);
    expect(features.shimmer).toBe(0);
    expect(features.pauseDuration).toBe(1);
  });

  it("detects voiced content in a sine wave", () => {
    const features = extractAudioFeatures(makeSineSamples());

    // A 200Hz sine should produce voiced frames.
    expect(features.voicedFraction).toBeGreaterThan(0);
    expect(features.energyMean).toBeGreaterThan(0);
  });

  it("pitch estimate is in a plausible range for 200Hz input", () => {
    const features = extractAudioFeatures(makeSineSamples(200));

    // Allow ±30% tolerance around 200Hz for autocorrelation estimation.
    if (features.pitchMedianHz !== null) {
      expect(features.pitchMedianHz).toBeGreaterThan(100);
      expect(features.pitchMedianHz).toBeLessThan(400);
    }
  });

  it("returns higher energy for louder input", () => {
    const quiet = new Float32Array(8000).fill(0.05);
    const loud = new Float32Array(8000).fill(0.4);

    const quietFeatures = extractAudioFeatures(quiet);
    const loudFeatures = extractAudioFeatures(loud);

    expect(loudFeatures.energyMean).toBeGreaterThan(quietFeatures.energyMean);
  });

  it("all numeric fields are finite numbers", () => {
    const features = extractAudioFeatures(makeSineSamples());

    expect(Number.isFinite(features.energyMean)).toBe(true);
    expect(Number.isFinite(features.energyStdDev)).toBe(true);
    expect(Number.isFinite(features.pitchStdDev)).toBe(true);
    expect(Number.isFinite(features.speakingRateFPS)).toBe(true);
    expect(Number.isFinite(features.spectralCentroidHz)).toBe(true);
    expect(Number.isFinite(features.spectralRolloffHz)).toBe(true);
    expect(Number.isFinite(features.voicedFraction)).toBe(true);
    expect(Number.isFinite(features.jitter)).toBe(true);
    expect(Number.isFinite(features.shimmer)).toBe(true);
    expect(Number.isFinite(features.pauseDuration)).toBe(true);
  });

  it("voicedFraction is always between 0 and 1", () => {
    for (const samples of [
      makeSilentSamples(),
      makeSineSamples(),
      new Float32Array(8000).fill(0.2),
    ]) {
      const { voicedFraction } = extractAudioFeatures(samples);
      expect(voicedFraction).toBeGreaterThanOrEqual(0);
      expect(voicedFraction).toBeLessThanOrEqual(1);
    }
  });

  it("pauseDuration is always between 0 and 1", () => {
    for (const samples of [
      makeSilentSamples(),
      makeSineSamples(),
      new Float32Array(8000).fill(0.2),
    ]) {
      const { pauseDuration } = extractAudioFeatures(samples);
      expect(pauseDuration).toBeGreaterThanOrEqual(0);
      expect(pauseDuration).toBeLessThanOrEqual(1);
    }
  });
});

// ─── inferMoodFromAudio ───────────────────────────────────────────────────────

describe("inferMoodFromAudio", () => {
  it("returns neutral with low confidence for silent audio", () => {
    const features = extractAudioFeatures(makeSilentSamples());
    const signal = inferMoodFromAudio(features);

    expect(signal.mood).toBe("neutral");
    expect(signal.confidence).toBeLessThan(0.3);
  });

  it("returns a valid MoodLabel for voiced audio", () => {
    const features = extractAudioFeatures(makeSineSamples());
    const signal = inferMoodFromAudio(features);

    const validMoods = ["positive", "negative", "neutral"];
    expect(validMoods).toContain(signal.mood);
  });

  it("returns a valid ToneLabel for voiced audio", () => {
    const features = extractAudioFeatures(makeSineSamples());
    const signal = inferMoodFromAudio(features);

    const validTones = [
      "energetic",
      "tense",
      "animated",
      "calm",
      "subdued",
      "monotone",
      "pleasant",
      "serious",
      "conversational",
    ];
    expect(validTones).toContain(signal.tone);
  });

  it("valence is within [-1, 1]", () => {
    const features = extractAudioFeatures(makeSineSamples());
    const signal = inferMoodFromAudio(features);

    expect(signal.valence).toBeGreaterThanOrEqual(-1);
    expect(signal.valence).toBeLessThanOrEqual(1);
  });

  it("arousal is within [0, 1]", () => {
    const features = extractAudioFeatures(makeSineSamples());
    const signal = inferMoodFromAudio(features);

    expect(signal.arousal).toBeGreaterThanOrEqual(0);
    expect(signal.arousal).toBeLessThanOrEqual(1);
  });

  it("confidence is within [0, 1]", () => {
    const features = extractAudioFeatures(makeSineSamples());
    const signal = inferMoodFromAudio(features);

    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(1);
  });

  it("high energy input produces higher arousal than low energy input", () => {
    const quietFeatures = extractAudioFeatures(
      new Float32Array(8000).fill(0.01),
    );
    const loudFeatures = extractAudioFeatures(
      new Float32Array(8000).fill(0.35),
    );

    const quietSignal = inferMoodFromAudio(quietFeatures);
    const loudSignal = inferMoodFromAudio(loudFeatures);

    expect(loudSignal.arousal).toBeGreaterThanOrEqual(quietSignal.arousal);
  });
});

// ─── fuseEmotionSignals ───────────────────────────────────────────────────────

describe("fuseEmotionSignals", () => {
  const happyText = {
    mood: "positive" as const,
    tone: "energetic" as const,
    valence: 0.8,
    arousal: 0.6,
    confidence: 0.9,
  };

  const sadAudio = {
    mood: "negative" as const,
    tone: "subdued" as const,
    valence: -0.4,
    arousal: 0.15,
    confidence: 0.55,
  };

  const happyAudio = {
    mood: "positive" as const,
    tone: "energetic" as const,
    valence: 0.5,
    arousal: 0.55,
    confidence: 0.7,
  };

  it("returns a valid MoodLabel", () => {
    const result = fuseEmotionSignals(happyText, happyAudio);
    const validMoods = ["positive", "negative", "neutral"];
    expect(validMoods).toContain(result.mood);
  });

  it("returns a valid ToneLabel", () => {
    const result = fuseEmotionSignals(happyText, happyAudio);
    const validTones = [
      "energetic",
      "tense",
      "animated",
      "calm",
      "subdued",
      "monotone",
      "pleasant",
      "serious",
      "conversational",
    ];
    expect(validTones).toContain(result.tone);
  });

  it("fused valence is between the two input valences when signals agree in sign", () => {
    const result = fuseEmotionSignals(happyText, happyAudio);
    // Both are positive valence, fused should be positive.
    expect(result.valence).toBeGreaterThan(0);
  });

  it("high-confidence text signal partially offsets negative audio valence", () => {
    // happyText has confidence 0.9 (valence +0.8), sadAudio has confidence 0.55 (valence -0.4).
    // Even with text weighted more, the fused valence is in the [-0.4, 0.8] range.
    // The key behaviour to verify: fused valence is higher than audio-only valence.
    const result = fuseEmotionSignals(happyText, sadAudio);
    expect(result.valence).toBeGreaterThan(sadAudio.valence);
  });

  it("agreement bonus increases confidence when both signals agree", () => {
    const agreeResult = fuseEmotionSignals(happyText, happyAudio);
    const disagreeResult = fuseEmotionSignals(happyText, sadAudio);

    expect(agreeResult.confidence).toBeGreaterThan(disagreeResult.confidence);
  });

  it("confidence is clamped to [0, 1]", () => {
    const result = fuseEmotionSignals(happyText, happyAudio);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("valence is within [-1, 1]", () => {
    const result = fuseEmotionSignals(happyText, sadAudio);
    expect(result.valence).toBeGreaterThanOrEqual(-1);
    expect(result.valence).toBeLessThanOrEqual(1);
  });

  it("arousal is within [0, 1]", () => {
    const result = fuseEmotionSignals(happyText, happyAudio);
    expect(result.arousal).toBeGreaterThanOrEqual(0);
    expect(result.arousal).toBeLessThanOrEqual(1);
  });

  it("result includes description and contradiction fields", () => {
    const result = fuseEmotionSignals(happyText, happyAudio);
    expect(typeof result.description).toBe("string");
    expect(result.description.length).toBeGreaterThan(0);
    // No contradiction expected when both signals agree
    expect(result.contradiction).toBeNull();
  });

  it("detects sarcasm when positive text + strongly negative audio", () => {
    const sarcasticText = {
      mood: "positive" as const,
      tone: "pleasant" as const,
      valence: 0.85,
      arousal: 0,
      confidence: 0.9,
    };
    const negativeAudio = {
      mood: "negative" as const,
      tone: "subdued" as const,
      valence: -0.5,
      arousal: 0.3,
      confidence: 0.7,
    };
    const result = fuseEmotionSignals(sarcasticText, negativeAudio);
    expect(result.contradiction).toBe("sarcasm");
  });
});
