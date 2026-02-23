/**
 * @meerkat/analyzer — utils tests
 *
 * Tests pure utility functions that don't require model loading.
 * These run fast and reliably in Node/vitest with no browser polyfills.
 */

import { describe, it, expect } from "vitest";
import {
  normaliseMoodLabel,
  moodToDimensions,
  deriveTone,
  scaleConfidence,
  isSilent,
} from "../utils";

// ─── normaliseMoodLabel ────────────────────────────────────────────────────────

describe("normaliseMoodLabel", () => {
  it("maps canonical labels unchanged", () => {
    expect(normaliseMoodLabel("happy")).toBe("happy");
    expect(normaliseMoodLabel("sad")).toBe("sad");
    expect(normaliseMoodLabel("angry")).toBe("angry");
    expect(normaliseMoodLabel("neutral")).toBe("neutral");
  });

  it("maps model alias labels to canonical labels", () => {
    expect(normaliseMoodLabel("joy")).toBe("happy");
    expect(normaliseMoodLabel("sadness")).toBe("sad");
    expect(normaliseMoodLabel("anger")).toBe("angry");
    expect(normaliseMoodLabel("fear")).toBe("fearful");
    expect(normaliseMoodLabel("disgust")).toBe("disgusted");
    expect(normaliseMoodLabel("surprise")).toBe("surprised");
  });

  it("is case-insensitive", () => {
    expect(normaliseMoodLabel("HAPPY")).toBe("happy");
    expect(normaliseMoodLabel("Joy")).toBe("happy");
    expect(normaliseMoodLabel("  angry  ")).toBe("angry");
  });

  it("falls back to neutral for unknown labels", () => {
    expect(normaliseMoodLabel("unknown_label")).toBe("neutral");
    expect(normaliseMoodLabel("")).toBe("neutral");
    expect(normaliseMoodLabel("confused")).toBe("neutral");
  });
});

// ─── moodToDimensions ────────────────────────────────────────────────────────

describe("moodToDimensions", () => {
  it("returns positive valence for happy", () => {
    const { valence, arousal } = moodToDimensions("happy");
    expect(valence).toBeGreaterThan(0);
    expect(arousal).toBeGreaterThan(0);
  });

  it("returns negative valence for sad", () => {
    const { valence } = moodToDimensions("sad");
    expect(valence).toBeLessThan(0);
  });

  it("returns negative valence and high arousal for angry", () => {
    const { valence, arousal } = moodToDimensions("angry");
    expect(valence).toBeLessThan(0);
    expect(arousal).toBeGreaterThan(0.5);
  });

  it("returns near-zero for neutral", () => {
    const { valence, arousal } = moodToDimensions("neutral");
    expect(valence).toBe(0);
    expect(arousal).toBe(0);
  });
});

// ─── deriveTone ───────────────────────────────────────────────────────────────

describe("deriveTone", () => {
  it("returns energetic for high valence + high arousal", () => {
    expect(deriveTone(0.8, 0.8)).toBe("energetic");
  });

  it("returns positive for high valence + low arousal", () => {
    expect(deriveTone(0.7, 0.1)).toBe("positive");
  });

  it("returns tense for low valence + high arousal", () => {
    expect(deriveTone(-0.6, 0.8)).toBe("tense");
  });

  it("returns negative for low valence + low arousal", () => {
    expect(deriveTone(-0.7, 0.1)).toBe("negative");
  });

  it("returns neutral for near-zero values", () => {
    expect(deriveTone(0.05, 0.1)).toBe("neutral");
  });

  it("derives correct tones from each mood via dimensions", () => {
    // happy → energetic or positive (depends on exact arousal)
    const happyDims = moodToDimensions("happy");
    const happyTone = deriveTone(happyDims.valence, happyDims.arousal);
    expect(["positive", "energetic"]).toContain(happyTone);

    // sad → negative or calm
    const sadDims = moodToDimensions("sad");
    const sadTone = deriveTone(sadDims.valence, sadDims.arousal);
    expect(["negative", "calm"]).toContain(sadTone);

    // angry → tense
    const angryDims = moodToDimensions("angry");
    const angryTone = deriveTone(angryDims.valence, angryDims.arousal);
    expect(angryTone).toBe("tense");
  });
});

// ─── scaleConfidence ─────────────────────────────────────────────────────────

describe("scaleConfidence", () => {
  it("returns close to 1 for high raw probability", () => {
    const conf = scaleConfidence(0.99);
    expect(conf).toBeGreaterThan(0.95);
    expect(conf).toBeLessThanOrEqual(1);
  });

  it("penalises low raw probability", () => {
    const low = scaleConfidence(0.3);
    const high = scaleConfidence(0.9);
    expect(low).toBeLessThan(high);
    expect(low).toBeLessThan(0.55);
  });

  it("clamps input at 1.0", () => {
    const overClamped = scaleConfidence(1.5);
    const atOne = scaleConfidence(1.0);
    expect(overClamped).toBeCloseTo(atOne, 5);
  });

  it("returns 0 for 0 probability", () => {
    expect(scaleConfidence(0)).toBe(0);
  });
});

// ─── isSilent ─────────────────────────────────────────────────────────────────

describe("isSilent", () => {
  it("returns true for all-zero samples", () => {
    const silence = new Float32Array(1000).fill(0);
    expect(isSilent(silence)).toBe(true);
  });

  it("returns false for audio with signal", () => {
    const audio = new Float32Array(1000);
    for (let i = 0; i < audio.length; i++) {
      audio[i] = Math.sin(i * 0.1) * 0.5;
    }
    expect(isSilent(audio)).toBe(false);
  });

  it("returns true for near-zero RMS (below threshold)", () => {
    const nearSilence = new Float32Array(1000).fill(0.0001);
    expect(isSilent(nearSilence)).toBe(true);
  });

  it("returns false for samples just above threshold", () => {
    const slight = new Float32Array(1000).fill(0.01);
    expect(isSilent(slight)).toBe(false);
  });
});
