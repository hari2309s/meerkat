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
  it("maps canonical 3-class labels unchanged", () => {
    expect(normaliseMoodLabel("positive")).toBe("positive");
    expect(normaliseMoodLabel("negative")).toBe("negative");
    expect(normaliseMoodLabel("neutral")).toBe("neutral");
  });

  it("maps DistilBERT SST-2 output labels to canonical labels", () => {
    expect(normaliseMoodLabel("POSITIVE")).toBe("positive");
    expect(normaliseMoodLabel("NEGATIVE")).toBe("negative");
    expect(normaliseMoodLabel("LABEL_1")).toBe("positive");
    expect(normaliseMoodLabel("LABEL_0")).toBe("negative");
  });

  it("is case-insensitive", () => {
    expect(normaliseMoodLabel("Positive")).toBe("positive");
    expect(normaliseMoodLabel("NEGATIVE")).toBe("negative");
    expect(normaliseMoodLabel("  neutral  ")).toBe("neutral");
  });

  it("falls back to neutral for unknown labels", () => {
    expect(normaliseMoodLabel("unknown_label")).toBe("neutral");
    expect(normaliseMoodLabel("")).toBe("neutral");
    expect(normaliseMoodLabel("confused")).toBe("neutral");
  });
});

// ─── moodToDimensions ────────────────────────────────────────────────────────

describe("moodToDimensions", () => {
  it("returns positive valence for positive", () => {
    const { valence, arousal } = moodToDimensions("positive");
    expect(valence).toBeGreaterThan(0);
    expect(arousal).toBeGreaterThan(0);
  });

  it("returns negative valence for negative", () => {
    const { valence } = moodToDimensions("negative");
    expect(valence).toBeLessThan(0);
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

  it("returns calm for high valence + low arousal", () => {
    expect(deriveTone(0.7, 0.1)).toBe("calm");
  });

  it("returns tense for negative valence + high arousal", () => {
    expect(deriveTone(-0.6, 0.8)).toBe("tense");
  });

  it("returns subdued for negative valence + low arousal", () => {
    expect(deriveTone(-0.7, 0.1)).toBe("subdued");
  });

  it("returns monotone for near-zero valence + low arousal", () => {
    expect(deriveTone(0.05, 0.1)).toBe("monotone");
  });

  it("returns conversational for near-zero valence + mid arousal", () => {
    expect(deriveTone(0.05, 0.5)).toBe("conversational");
  });

  it("returns pleasant for positive valence + mid arousal", () => {
    expect(deriveTone(0.5, 0.5)).toBe("pleasant");
  });

  it("returns serious for negative valence + mid arousal", () => {
    expect(deriveTone(-0.5, 0.5)).toBe("serious");
  });

  it("returns animated for near-zero valence + high arousal", () => {
    expect(deriveTone(0.05, 0.8)).toBe("animated");
  });

  it("derives correct tones from each mood via dimensions", () => {
    // positive → calm or pleasant (depends on exact arousal)
    const posDims = moodToDimensions("positive");
    const posTone = deriveTone(posDims.valence, posDims.arousal);
    expect(["calm", "pleasant", "energetic"]).toContain(posTone);

    // negative → subdued, serious, or tense
    const negDims = moodToDimensions("negative");
    const negTone = deriveTone(negDims.valence, negDims.arousal);
    expect(["subdued", "serious", "tense"]).toContain(negTone);
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
