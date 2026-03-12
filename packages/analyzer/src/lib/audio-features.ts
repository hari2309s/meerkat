/**
 * @meerkat/analyzer — audio feature extraction
 *
 * Derives mood and tone signals directly from the raw audio waveform —
 * independently of and complementary to text-based sentiment.
 *
 * Audio-signal features catch what words miss:
 *   – A "fine" spoken in a flat, low-energy voice reads as neutral text
 *     but reveals sadness via pitch and energy analysis.
 *   – High jitter/shimmer in voice reveals stress even when words say "I'm okay".
 *   – Rapid speech and high-energy bursts signal excitement or tension.
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
 *           ├── extractSpectralFeatures() spectral centroid + rolloff
 *           ├── computeJitter()    relative pitch period variation
 *           ├── computeShimmer()   relative amplitude variation
 *           └── computePauseDuration() unvoiced fraction
 *
 *   AudioFeatures → fuse with EmotionResult → refined AnalysisResult
 */

import { WHISPER_SAMPLE_RATE } from "../constants.js";
import type {
  MoodLabel,
  ToneLabel,
  ContradictionType,
  AudioFeatures as AudioFeaturesType,
} from "../types.js";
import {
  classifyMoodFromValence,
  deriveTone,
  generateDescription,
} from "../utils.js";

// Re-export AudioFeatures from types for callers that import from audio-features
export type { AudioFeatures } from "../types.js";

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
 * Features extracted:
 *   - pitchMedianHz, pitchStdDev — F0 pitch analysis
 *   - energyMean, energyStdDev — RMS loudness
 *   - speakingRateFPS — voiced onset rate (syllable proxy)
 *   - spectralCentroidHz, spectralRolloffHz — timbre
 *   - voicedFraction — fraction of voiced frames
 *   - jitter — relative pitch period variation (voice tremor indicator)
 *   - shimmer — relative amplitude variation (voice shakiness indicator)
 *   - pauseDuration — fraction of time spent in silence
 *
 * @param samples — Float32Array of 16kHz mono PCM (from blobToFloat32).
 * @returns       — AudioFeatures struct.
 */
export function extractAudioFeatures(samples: Float32Array): AudioFeaturesType {
  const frames = buildFrames(samples);

  if (frames.length === 0) {
    return silentFeatures();
  }

  // ── Energy per frame ──────────────────────────────────────────────────────
  const energies = frames.map(rmsEnergy);
  const voicedMask = energies.map((e) => e >= MIN_VOICED_ENERGY);
  const voicedCount = voicedMask.filter(Boolean).length;
  const voicedFraction = voicedCount / frames.length;
  const energyMean = mean(energies);
  const energyStdDev = stdDev(energies, energyMean);

  // ── Shimmer (relative amplitude variation between consecutive voiced frames)
  const voicedEnergies: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    if (voicedMask[i]) voicedEnergies.push(energies[i]!);
  }
  const shimmer =
    voicedEnergies.length > 1 && energyMean > 0
      ? computeShimmer(voicedEnergies) / energyMean
      : 0;

  // ── Pause duration (fraction of unvoiced time) ────────────────────────────
  const pauseDuration = 1 - voicedFraction;

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

  // ── Jitter (relative pitch period variation) ──────────────────────────────
  // jitter = pitchStdDev / pitchMedianHz (normalized period variation)
  // Values > 0.02 indicate elevated jitter (voice tremor)
  const jitter =
    pitchMedianHz !== null && pitchMedianHz > 0
      ? Math.min(pitchStdDev / pitchMedianHz, 1.0)
      : 0;

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
    jitter,
    shimmer,
    pauseDuration,
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
 *      contradiction is flagged and confidence is reduced.
 *   2. Fallback: when transcription is empty (silence, whisper), the
 *      audio-only mood provides the AnalysisResult mood/tone.
 *
 * @param features — AudioFeatures from extractAudioFeatures().
 * @returns        — AudioMoodSignal with mood, tone, valence, arousal.
 */
export function inferMoodFromAudio(
  features: AudioFeaturesType,
): AudioMoodSignal {
  // ── Near-silent / unvoiced guard ─────────────────────────────────────────
  if (features.voicedFraction < 0.05 || features.energyMean < 0.002) {
    return {
      mood: "neutral",
      tone: "monotone",
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

  // Jitter/shimmer increase perceived arousal (stress tension)
  const tensionBoost = Math.min((features.jitter + features.shimmer) * 5, 0.2);

  const arousal = Math.min(
    0.45 * normEnergy + 0.35 * normRate + 0.2 * normPitchVar + tensionBoost,
    1.0,
  );

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

  const mood = classifyMoodFromValence(valence);
  const tone = deriveTone(valence, arousal);

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
 * Implements the multi-modal fusion algorithm from the analysis plan:
 *
 * 1. Dynamic signal weighting (50/50 default, shifts based on signal quality)
 *    - Weight text more: high text confidence, quiet audio, monotone speech
 *    - Weight audio more: expressive pitch, high jitter, ambiguous text
 *
 * 2. Contradiction detection:
 *    - Sarcasm: positive text + negative audio, diff > 0.7
 *    - Masking: negative text + neutral/positive audio, diff > 0.5
 *    - Stress: neutral text + high jitter/shimmer
 *
 * 3. Confidence calculation (starts at 50%):
 *    - Increases when signals agree
 *    - Increases based on individual confidence levels
 *    - Decreases by 20% when contradiction detected
 *
 * 4. Natural language description generation
 *
 * @param textMood   — Sentiment from DistilBERT (valence, low/no arousal).
 * @param audioMood  — Mood signal from acoustic features.
 * @param audioFeatures — Raw audio features for description generation.
 * @returns          — Fused valence, arousal, mood, tone, confidence, description, contradiction.
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
  audioFeatures?: AudioFeaturesType,
): {
  mood: MoodLabel;
  tone: ToneLabel;
  valence: number;
  arousal: number;
  confidence: number;
  description: string;
  contradiction: ContradictionType;
} {
  const features = audioFeatures;

  // ── Dynamic signal weighting ──────────────────────────────────────────────
  // Start at 50/50, shift based on signal quality per the analysis plan.
  let textWeight = 0.5;

  // Weight text more when:
  if (textMood.confidence > 0.9) textWeight += 0.15;
  if (features && features.energyMean < 0.1) textWeight += 0.1; // quiet audio
  if (features && features.pitchStdDev < 10) textWeight += 0.1; // monotone speech

  // Weight audio more when:
  if (features && features.pitchStdDev > 40) textWeight -= 0.15; // expressive pitch
  if (features && features.jitter > 0.02) textWeight -= 0.15; // voice tremor
  if (textMood.confidence < 0.65) textWeight -= 0.1; // low text confidence

  // Clamp to plan's allowed range: 20%–80%
  textWeight = Math.max(0.2, Math.min(0.8, textWeight));

  // ── Contradiction detection ───────────────────────────────────────────────
  // Detect sarcasm, masking, and stress per the analysis plan.
  let contradiction: ContradictionType = null;
  const valenceDiff = textMood.valence - audioMood.valence;

  if (textMood.valence > 0.3 && audioMood.valence < 0 && valenceDiff > 0.7) {
    // Sarcasm: positive words + negative prosody
    contradiction = "sarcasm";
    textWeight = Math.min(textWeight, 0.3); // weight audio more for sarcasm
  } else if (
    textMood.valence < -0.3 &&
    audioMood.valence >= 0 &&
    Math.abs(valenceDiff) > 0.5
  ) {
    // Masking: negative words + neutral/positive prosody
    contradiction = "masking";
  } else if (
    Math.abs(textMood.valence) < 0.3 &&
    features &&
    (features.jitter > 0.02 || features.shimmer > 0.05)
  ) {
    // Stress: neutral words + high jitter/shimmer
    contradiction = "stress";
    // Force higher arousal when stress detected (the body knows)
    audioMood = { ...audioMood, arousal: Math.max(audioMood.arousal, 0.5) };
  }

  const fusedAudioWeight = 1.0 - textWeight;

  // ── Fused valence and arousal ─────────────────────────────────────────────
  const fusedValence =
    textMood.valence * textWeight + audioMood.valence * fusedAudioWeight;

  // Arousal: text gives arousal=0 (DistilBERT has no arousal signal),
  // so arousal is primarily determined by audio features.
  // When textWeight is high, we still rely mostly on audio for arousal.
  // Use max(textWeight, 0.3) for audio on arousal to ensure it dominates.
  const arousalAudioWeight = Math.max(fusedAudioWeight, 0.7);
  const fusedArousal = Math.min(
    textMood.arousal * (1 - arousalAudioWeight) +
      audioMood.arousal * arousalAudioWeight,
    1.0,
  );

  const fusedMood = classifyMoodFromValence(fusedValence);
  const fusedTone = deriveTone(fusedValence, fusedArousal);

  // ── Confidence calculation ────────────────────────────────────────────────
  // Start at 50%, adjust based on agreement and individual confidences.
  let fusedConfidence = 0.5;

  // Increase if individual confidences are high
  fusedConfidence += textMood.confidence * 0.25;
  fusedConfidence += audioMood.confidence * 0.15;

  // Agreement bonus/penalty: signals in same valence quadrant → bonus
  const sameValenceSign =
    Math.sign(textMood.valence) === Math.sign(audioMood.valence) ||
    Math.abs(textMood.valence) < 0.2;
  fusedConfidence += sameValenceSign ? 0.05 : -0.05;

  // Contradiction penalty: reduce by 20% when contradiction detected
  if (contradiction !== null) {
    fusedConfidence *= 0.8;
  }

  // Clamp to [0, 1]
  fusedConfidence = Math.max(0, Math.min(1.0, fusedConfidence));

  // ── Description generation ────────────────────────────────────────────────
  const effectiveFeatures: AudioFeaturesType = features ?? {
    pitchMedianHz: null,
    pitchStdDev: 0,
    energyMean: audioMood.arousal,
    energyStdDev: 0,
    speakingRateFPS: 0,
    spectralCentroidHz: 0,
    spectralRolloffHz: 0,
    voicedFraction: audioMood.confidence,
    jitter: 0,
    shimmer: 0,
    pauseDuration: 0,
  };

  const description = generateDescription(
    fusedMood,
    fusedTone,
    effectiveFeatures,
    contradiction,
  );

  return {
    mood: fusedMood,
    tone: fusedTone,
    valence: fusedValence,
    arousal: fusedArousal,
    confidence: fusedConfidence,
    description,
    contradiction,
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
 * Computes shimmer as mean absolute difference between consecutive amplitude values.
 * Used to measure amplitude variation (voice shakiness).
 */
function computeShimmer(energyValues: number[]): number {
  if (energyValues.length < 2) return 0;
  let sumDiff = 0;
  for (let i = 1; i < energyValues.length; i++) {
    sumDiff += Math.abs((energyValues[i] ?? 0) - (energyValues[i - 1] ?? 0));
  }
  return sumDiff / (energyValues.length - 1);
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
function silentFeatures(): AudioFeaturesType {
  return {
    pitchMedianHz: null,
    pitchStdDev: 0,
    energyMean: 0,
    energyStdDev: 0,
    speakingRateFPS: 0,
    spectralCentroidHz: 0,
    spectralRolloffHz: 0,
    voicedFraction: 0,
    jitter: 0,
    shimmer: 0,
    pauseDuration: 1,
  };
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
