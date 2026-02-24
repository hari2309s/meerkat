/**
 * @meerkat/analyzer — audio feature extraction
 *
 * Derives emotion, mood, and tone signals directly from the raw audio
 * waveform — independently of and complementary to text-based classification.
 *
 * Audio-signal features catch what words miss:
 *   – A "fine" spoken in a flat, low-energy voice reads as neutral text
 *     but reveals sadness via pitch and energy analysis.
 *   – Rapid speech and high-energy bursts signal excitement or anger even
 *     when the transcript is short or empty.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Privacy guarantee
 * ──────────────────────────────────────────────────────────────────────────────
 * All computation runs on raw PCM samples already decoded in the browser.
 * No audio or derived features are sent to a server.
 * No additional models or network requests are required.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Pipeline
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   audioBlob
 *     └── blobToFloat32()          (already decoded for Whisper)
 *           ├── extractPitch()     autocorrelation pitch estimation (YIN-like)
 *           ├── extractEnergy()    RMS energy per frame + stats
 *           ├── extractSpeakingRate() voiced frame density
 *           └── extractSpectralFeatures() spectral centroid + rolloff
 *
 *   AudioFeatures → fuse with EmotionResult → refined AnalysisResult
 */

import { WHISPER_SAMPLE_RATE } from "../constants.js";
import type { MoodLabel, ToneLabel } from "../types.js";
import { moodToDimensions, deriveTone } from "../utils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Acoustic features extracted directly from the audio waveform.
 * These are computed in the browser with no model or network dependency.
 */
export interface AudioFeatures {
  /**
   * Median fundamental frequency (F0) of voiced segments in Hz.
   * Null when no voiced segments are detected (silence or whisper).
   * Typical range: 85–255 Hz (male), 165–255 Hz (female).
   */
  pitchMedianHz: number | null;

  /**
   * Pitch variability (standard deviation of F0 over voiced frames).
   * High variability → expressive, emotional speech.
   * Low variability → monotone, flat, or suppressed affect.
   */
  pitchStdDev: number;

  /**
   * Root-mean-square energy normalised to 0–1.
   * Proxy for perceived loudness / intensity.
   */
  energyMean: number;

  /**
   * Energy variability (std dev of frame-level RMS).
   * High variability → dynamic, engaged speech.
   * Low variability → subdued, tired, or flat speech.
   */
  energyStdDev: number;

  /**
   * Estimated speaking rate in voiced frames per second.
   * Higher → faster, more energetic or agitated speech.
   * Lower → slow, deliberate, or depressed speech.
   */
  speakingRateFPS: number;

  /**
   * Spectral centroid — centre of mass of the frequency spectrum (Hz).
   * Higher centroid → brighter, sharper timbre (tense, excited, angry).
   * Lower centroid → darker, softer timbre (sad, calm, neutral).
   */
  spectralCentroidHz: number;

  /**
   * Spectral rolloff — frequency below which 85% of energy lies (Hz).
   * Correlates with brightness and consonant voicing patterns.
   */
  spectralRolloffHz: number;

  /**
   * Fraction of frames classified as voiced (0–1).
   * Very low → whisper, silence, or mostly non-speech.
   */
  voicedFraction: number;
}

/**
 * Mood/emotion inference from audio features alone (no transcript needed).
 * Used as a signal to cross-validate or override text-based classification.
 */
export interface AudioMoodSignal {
  /** Best-guess mood from acoustic features. */
  mood: MoodLabel;
  /** Qualitative tone from acoustic features. */
  tone: ToneLabel;
  /** Acoustic valence estimate (−1.0 to 1.0). */
  valence: number;
  /** Acoustic arousal estimate (0.0 to 1.0). */
  arousal: number;
  /**
   * Confidence in the acoustic-only estimate (0–1).
   * Lower when audio is short, near-silent, or features are ambiguous.
   */
  confidence: number;
}

// ─── Frame analysis config ────────────────────────────────────────────────────

const FRAME_SIZE = 512; // ~32ms at 16kHz
const HOP_SIZE = 256; // ~16ms hop (50% overlap)
const MIN_VOICED_ENERGY = 0.005; // RMS below this → unvoiced frame
const AUTOCORR_MIN_PERIOD = Math.round(WHISPER_SAMPLE_RATE / 600); // 600 Hz max pitch
const AUTOCORR_MAX_PERIOD = Math.round(WHISPER_SAMPLE_RATE / 60); // 60 Hz min pitch

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts acoustic features from raw 16kHz mono PCM samples.
 *
 * Accepts the same Float32Array produced by `blobToFloat32()` — zero
 * additional decoding is required.
 *
 * @param samples — Float32Array of 16kHz mono PCM (from blobToFloat32).
 * @returns       — AudioFeatures struct.
 *
 * @example
 * ```ts
 * import { blobToFloat32 } from "../utils";
 * import { extractAudioFeatures } from "./audio-features";
 *
 * const samples = await blobToFloat32(blob);
 * const features = extractAudioFeatures(samples);
 * // features.pitchMedianHz, features.energyMean, ...
 * ```
 */
export function extractAudioFeatures(samples: Float32Array): AudioFeatures {
  const frames = buildFrames(samples);

  if (frames.length === 0) {
    return silentFeatures();
  }

  // ── Energy per frame ──────────────────────────────────────────────────────
  const energies = frames.map(rmsEnergy);
  const voicedMask = energies.map((e) => e >= MIN_VOICED_ENERGY);
  const voicedFraction = voicedMask.filter(Boolean).length / frames.length;
  const energyMean = mean(energies);
  const energyStdDev = stdDev(energies, energyMean);

  // ── Pitch via autocorrelation ─────────────────────────────────────────────
  const pitchValues: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    if (!voicedMask[i]) continue;
    const f0 = estimatePitch(frames[i]!);
    if (f0 !== null) pitchValues.push(f0);
  }

  const pitchMedianHz = pitchValues.length > 0 ? median(pitchValues) : null;
  const pitchMeanVal = pitchValues.length > 0 ? mean(pitchValues) : 0;
  const pitchStdDev =
    pitchValues.length > 1 ? stdDev(pitchValues, pitchMeanVal) : 0;

  // ── Speaking rate ─────────────────────────────────────────────────────────
  // Count transitions into voiced regions (voiced frame onset = syllable proxy)
  let voicedOnsets = 0;
  for (let i = 1; i < voicedMask.length; i++) {
    if (voicedMask[i] && !voicedMask[i - 1]) voicedOnsets++;
  }
  const durationSeconds =
    (frames.length * HOP_SIZE + FRAME_SIZE) / WHISPER_SAMPLE_RATE;
  const speakingRateFPS =
    durationSeconds > 0 ? voicedOnsets / durationSeconds : 0;

  // ── Spectral features ─────────────────────────────────────────────────────
  const spectralCentroids: number[] = [];
  const spectralRolloffs: number[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (!voicedMask[i]) continue;
    const { centroid, rolloff } = spectralFeatures(frames[i]!);
    spectralCentroids.push(centroid);
    spectralRolloffs.push(rolloff);
  }

  const spectralCentroidHz =
    spectralCentroids.length > 0 ? mean(spectralCentroids) : 0;
  const spectralRolloffHz =
    spectralRolloffs.length > 0 ? mean(spectralRolloffs) : 0;

  return {
    pitchMedianHz,
    pitchStdDev,
    energyMean,
    energyStdDev,
    speakingRateFPS,
    spectralCentroidHz,
    spectralRolloffHz,
    voicedFraction,
  };
}

/**
 * Infers mood, tone, valence, and arousal from acoustic features alone.
 *
 * Uses a rule-based mapping derived from empirical associations in the
 * prosody-affect literature (Scherer 2003; Juslin & Laukka 2003).
 * This does not require any ML model — it runs synchronously.
 *
 * The result is used in two ways:
 *   1. Cross-validation: if audio signal contradicts text classification,
 *      confidence is reduced and a fused result is returned.
 *   2. Fallback: when transcription is empty (silence, whisper), the
 *      audio-only mood provides the AnalysisResult mood/tone.
 *
 * @param features — AudioFeatures from extractAudioFeatures().
 * @returns        — AudioMoodSignal with mood, tone, valence, arousal.
 *
 * @example
 * ```ts
 * const signal = inferMoodFromAudio(features);
 * // { mood: "angry", tone: "tense", valence: -0.6, arousal: 0.8, confidence: 0.72 }
 * ```
 */
export function inferMoodFromAudio(features: AudioFeatures): AudioMoodSignal {
  // ── Near-silent / unvoiced guard ─────────────────────────────────────────
  if (features.voicedFraction < 0.05 || features.energyMean < 0.002) {
    return {
      mood: "neutral",
      tone: "neutral",
      valence: 0,
      arousal: 0,
      confidence: 0.1,
    };
  }

  // ── Arousal estimate from energy + speaking rate + pitch variability ─────
  // Normalise each signal to [0, 1] using empirically reasonable caps.
  const normEnergy = Math.min(features.energyMean / 0.3, 1.0);
  const normRate = Math.min(features.speakingRateFPS / 8.0, 1.0);
  const normPitchVar = Math.min(features.pitchStdDev / 80, 1.0);

  const arousal = 0.45 * normEnergy + 0.35 * normRate + 0.2 * normPitchVar;

  // ── Valence estimate from spectral brightness + pitch height ─────────────
  // High spectral centroid + high pitch → more likely positive or tense.
  // Low pitch + low centroid → more likely sad or calm.
  const normCentroid = Math.min(features.spectralCentroidHz / 3000, 1.0);
  const normPitch = features.pitchMedianHz
    ? Math.min((features.pitchMedianHz - 80) / 250, 1.0)
    : 0.5;

  // Valence is ambiguous from audio alone — high arousal pushes toward
  // negative (anger/fear) in our model unless brightness is also very high.
  // We cap |valence| at 0.6 since text is more reliable for valence.
  const rawValence = 0.5 * normPitch + 0.5 * normCentroid - 0.5;
  const valenceBias = arousal > 0.65 ? -0.2 : 0; // high arousal → slightly negative
  const valence = Math.max(-0.6, Math.min(0.6, rawValence + valenceBias));

  const tone = deriveTone(valence, arousal);
  const mood = toneAndArousalToMood(tone, arousal, valence);

  // ── Confidence ────────────────────────────────────────────────────────────
  // Higher confidence when signal is strong and clean.
  const signalClarity =
    features.voicedFraction * (1 - Math.min(features.energyStdDev / 0.2, 0.8));
  const confidence = Math.min(0.55 + signalClarity * 0.35, 0.85);

  return { mood, tone, valence, arousal, confidence };
}

/**
 * Fuses a text-based EmotionResult with an audio-based AudioMoodSignal
 * into a single best-estimate mood, tone, valence, and arousal.
 *
 * Fusion strategy:
 *   – Text result is weighted higher (0.65) as it is generally more accurate.
 *   – Audio signal (0.35) modulates when it is confident and diverges.
 *   – When text confidence is very low (short transcript), audio weight rises.
 *   – When audio and text agree on arousal quadrant, confidence increases.
 *
 * @param textMood   — Emotion classification from transcript.
 * @param audioMood  — Mood signal from acoustic features.
 * @returns          — Fused valence, arousal, mood, tone, and final confidence.
 *
 * @example
 * ```ts
 * const fused = fuseEmotionSignals(textResult, audioSignal);
 * // { mood: "sad", tone: "negative", valence: -0.65, arousal: -0.3, confidence: 0.79 }
 * ```
 */
export function fuseEmotionSignals(
  textMood: {
    mood: MoodLabel;
    tone: ToneLabel;
    valence: number;
    arousal: number;
    confidence: number;
  },
  audioMood: AudioMoodSignal,
): {
  mood: MoodLabel;
  tone: ToneLabel;
  valence: number;
  arousal: number;
  confidence: number;
} {
  // Dynamic text weight: rises when text confidence is high.
  const textWeight = 0.5 + 0.25 * textMood.confidence;
  const audioWeight = 1.0 - textWeight;

  const fusedValence =
    textMood.valence * textWeight + audioMood.valence * audioWeight;
  const fusedArousal =
    textMood.arousal * textWeight + audioMood.arousal * audioWeight;

  const fusedTone = deriveTone(fusedValence, fusedArousal);
  const fusedMood = toneAndArousalToMood(fusedTone, fusedArousal, fusedValence);

  // ── Agreement bonus ───────────────────────────────────────────────────────
  // When text and audio agree on the high-level tone quadrant, reward confidence.
  const textDims = moodToDimensions(textMood.mood);
  const sameArousalQuadrant =
    textDims.arousal > 0.3 === audioMood.arousal > 0.3;
  const sameValenceSign =
    Math.sign(textDims.valence) === Math.sign(audioMood.valence) ||
    Math.abs(textDims.valence) < 0.2;

  const agreementBonus = sameArousalQuadrant && sameValenceSign ? 0.08 : -0.05;

  const fusedConfidence = Math.min(
    textMood.confidence * 0.7 + audioMood.confidence * 0.3 + agreementBonus,
    1.0,
  );

  return {
    mood: fusedMood,
    tone: fusedTone,
    valence: fusedValence,
    arousal: fusedArousal,
    confidence: Math.max(0, fusedConfidence),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Splits samples into overlapping frames. */
function buildFrames(samples: Float32Array): Float32Array[] {
  const frames: Float32Array[] = [];
  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    frames.push(samples.subarray(start, start + FRAME_SIZE) as Float32Array);
  }
  return frames;
}

/** RMS amplitude of a frame. */
function rmsEnergy(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += (frame[i] ?? 0) ** 2;
  }
  return Math.sqrt(sum / frame.length);
}

/**
 * Estimates fundamental frequency (F0) via normalised autocorrelation (NAC).
 * A simplified YIN-like method that is fast enough for real-time use.
 * Returns null for unvoiced / aperiodic frames.
 */
function estimatePitch(frame: Float32Array): number | null {
  const n = frame.length;

  // Compute autocorrelation for lags in [minPeriod, maxPeriod].
  let bestCorr = -Infinity;
  let bestLag = -1;

  // Normalise energy at lag 0.
  let r0 = 0;
  for (let i = 0; i < n; i++) r0 += (frame[i] ?? 0) ** 2;
  if (r0 < 1e-6) return null; // silence

  for (
    let lag = AUTOCORR_MIN_PERIOD;
    lag <= Math.min(AUTOCORR_MAX_PERIOD, n - 1);
    lag++
  ) {
    let rlag = 0;
    let norm = 0;
    for (let i = 0; i < n - lag; i++) {
      rlag += (frame[i] ?? 0) * (frame[i + lag] ?? 0);
      norm += (frame[i] ?? 0) ** 2 + (frame[i + lag] ?? 0) ** 2;
    }
    const nac = norm > 0 ? (2 * rlag) / norm : 0;
    if (nac > bestCorr) {
      bestCorr = nac;
      bestLag = lag;
    }
  }

  // Require meaningful periodicity — discard noisy frames.
  if (bestCorr < 0.35 || bestLag < 0) return null;

  return WHISPER_SAMPLE_RATE / bestLag;
}

/** Spectral centroid and 85%-rolloff for a frame (uses magnitude spectrum). */
function spectralFeatures(frame: Float32Array): {
  centroid: number;
  rolloff: number;
} {
  const n = frame.length;
  const binHz = WHISPER_SAMPLE_RATE / n;

  // Magnitude spectrum via naive DFT up to Nyquist.
  // For a 512-sample frame this is fast enough (~130k multiplies).
  const half = Math.floor(n / 2);
  const mag = new Float32Array(half);
  let totalEnergy = 0;

  for (let k = 0; k < half; k++) {
    let re = 0;
    let im = 0;
    const twoPiKoverN = (2 * Math.PI * k) / n;
    for (let t = 0; t < n; t++) {
      re += (frame[t] ?? 0) * Math.cos(twoPiKoverN * t);
      im -= (frame[t] ?? 0) * Math.sin(twoPiKoverN * t);
    }
    mag[k] = Math.sqrt(re * re + im * im);
    totalEnergy += mag[k]!;
  }

  if (totalEnergy < 1e-9) return { centroid: 0, rolloff: 0 };

  // Spectral centroid.
  let weightedSum = 0;
  for (let k = 0; k < half; k++) {
    weightedSum += k * binHz * (mag[k] ?? 0);
  }
  const centroid = weightedSum / totalEnergy;

  // 85% spectral rolloff.
  let cumulative = 0;
  const threshold = 0.85 * totalEnergy;
  let rolloffBin = half - 1;
  for (let k = 0; k < half; k++) {
    cumulative += mag[k] ?? 0;
    if (cumulative >= threshold) {
      rolloffBin = k;
      break;
    }
  }
  const rolloff = rolloffBin * binHz;

  return { centroid, rolloff };
}

/** Returns neutral features for silent/empty audio. */
function silentFeatures(): AudioFeatures {
  return {
    pitchMedianHz: null,
    pitchStdDev: 0,
    energyMean: 0,
    energyStdDev: 0,
    speakingRateFPS: 0,
    spectralCentroidHz: 0,
    spectralRolloffHz: 0,
    voicedFraction: 0,
  };
}

/**
 * Maps tone + dimensional estimates back to the canonical MoodLabel.
 * Used after fusing valence/arousal from multiple signals.
 */
function toneAndArousalToMood(
  tone: ToneLabel,
  arousal: number,
  valence: number,
): MoodLabel {
  switch (tone) {
    case "energetic":
      return valence > 0.3 ? "happy" : "surprised";
    case "tense":
      return arousal > 0.75 ? "angry" : "fearful";
    case "negative":
      return "sad";
    case "positive":
      return "happy";
    case "calm":
      return valence < -0.2 ? "disgusted" : "neutral";
    case "neutral":
    default:
      return "neutral";
  }
}

// ─── Statistics helpers ───────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], mu: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((acc, v) => acc + (v - mu) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}
