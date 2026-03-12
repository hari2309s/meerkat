# @meerkat/analyzer

On-device multi-modal voice analysis for Meerkat — mood, tone, transcription, and contradiction detection from both the audio signal and the transcribed text.

> **No audio, transcript, or analysis result ever leaves the device.** All three streams run entirely in the browser. Models are downloaded once and cached in the browser's OPFS.

---

## How it works

Analysis uses a **three-stream pipeline**. Streams 1 and 3 run concurrently; the fusion layer combines all three into a single result:

```
audioBlob
  ├── Stream 1: extractAudioFeatures()   ← pitch, energy, jitter, shimmer,
  │                                         speaking rate, pause duration
  │             inferMoodFromAudio()     ← rule-based acoustic mood signal
  │
  └── Stream 3: transcribeSamples()     ← Whisper tiny WASM (~75 MB)
                classifyEmotion()       ← DistilBERT SST-2 ONNX (~67 MB)
                                           POSITIVE/NEGATIVE → valence ±score

Fusion: fuseEmotionSignals(textResult, audioMood, audioFeatures)
  → dynamic text/audio weighting (20–80%)
  → contradiction detection (sarcasm · masking · stress)
  → confidence calculation (starts 50%, adjusted by agreement)
  → natural language description
  → AnalysisResult
```

**Why three streams?** Each catches what the others miss:

- **Text alone** misses sarcasm, stress, and emotional masking — "Oh great, just what I needed" with a flat voice reads as positive text.
- **Audio alone** cannot reliably extract valence from speech — it is too ambiguous without word meaning.
- **Fusion** detects contradictions between what was said and how it was said, and weighs each signal based on its quality (text confidence, pitch expressiveness, jitter level).

| Stream            | What it measures                                                                            | Model                                      | Network         |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------- |
| Acoustic features | Pitch (F0), energy (RMS), jitter, shimmer, speaking rate, pause duration, spectral centroid | None                                       | Never           |
| Text sentiment    | Binary positive/negative sentiment from transcript                                          | Whisper + DistilBERT SST-2 (~142 MB total) | First load only |
| Fusion            | Dynamic-weighted combination, contradiction detection                                       | None (rule-based)                          | Never           |

---

## What it produces

| Step                        | Model                                                         | Size   | Output                                                                                  |
| --------------------------- | ------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| Acoustic feature extraction | None (autocorrelation + naive DFT)                            | 0 MB   | `AudioFeatures` — pitch, energy, jitter, shimmer, pause                                 |
| Transcription               | `onnx-community/whisper-tiny.en` (q8 ONNX)                    | ~75 MB | Plain text transcript                                                                   |
| Text sentiment              | `Xenova/distilbert-base-uncased-finetuned-sst-2-english` (q8) | ~67 MB | Valence ±score, confidence                                                              |
| Fusion                      | Rule-based weighting                                          | 0 MB   | `AnalysisResult` — mood, tone, valence, arousal, confidence, description, contradiction |

Both ML models load lazily on first use and are cached in the browser's Origin Private File System (OPFS). After the initial download (~142 MB total), analysis is fully offline. Acoustic feature extraction is always available with no download at all.

---

## Privacy guarantee

- Audio is decoded to PCM in the browser — the raw bytes never leave the tab.
- Acoustic feature extraction runs entirely in JavaScript from the decoded PCM — no model, no network.
- Transcription runs via WebAssembly — no network request during inference.
- Text sentiment runs via ONNX — no network request during inference.
- Model weights are fetched from Hugging Face Hub on first use only. After that, all inference is fully offline.

---

## Installation

```bash
pnpm add @meerkat/analyzer
```

---

## Usage

### Full three-stream pipeline (recommended)

```ts
import { analyzeVoice } from "@meerkat/analyzer";

const result = await analyzeVoice(recordedBlob, { language: "en" });

result.transcript; // "I'm really excited about this project"
result.mood; // "positive"            (positive | negative | neutral)
result.tone; // "energetic"           (9-tone Russell circumplex quadrant)
result.valence; // 0.74                  (−1.0 to 1.0, fused from text + audio)
result.arousal; // 0.68                  (0.0 to 1.0, primarily from audio)
result.confidence; // 0.87                  (higher when signals agree)
result.description; // "Positive mood, energetic tone, high pitched, speaking quickly"
result.contradiction; // null                 (null | "sarcasm" | "masking" | "stress")
result.analysedAt; // 1700000000000         (Unix ms)

// Raw acoustic features are also included:
result.audioFeatures?.pitchMedianHz; // 218
result.audioFeatures?.energyMean; // 0.22
result.audioFeatures?.jitter; // 0.008   (< 0.02 = normal)
result.audioFeatures?.shimmer; // 0.031   (< 0.05 = normal)
result.audioFeatures?.pauseDuration; // 0.18    (fraction of silence)
```

### Audio-only mood (no model needed, always available)

Useful before models are loaded, or for very short clips where transcription isn't meaningful.

```ts
import { extractAudioFeatures, inferMoodFromAudio } from "@meerkat/analyzer";
import { blobToFloat32 } from "@meerkat/analyzer/utils";

const samples = await blobToFloat32(blob);
const features = extractAudioFeatures(samples);
// {
//   pitchMedianHz: 182,
//   pitchStdDev: 23.4,
//   energyMean: 0.14,
//   energyStdDev: 0.07,
//   speakingRateFPS: 3.8,
//   spectralCentroidHz: 1340,
//   spectralRolloffHz: 3200,
//   voicedFraction: 0.72,
//   jitter: 0.011,        // < 0.02 = normal voice
//   shimmer: 0.039,       // < 0.05 = normal
//   pauseDuration: 0.28   // fraction of silence
// }

const audioMood = inferMoodFromAudio(features);
// { mood: "neutral", tone: "monotone", valence: -0.12, arousal: 0.21, confidence: 0.58 }
```

### Transcription only

```ts
import { transcribe } from "@meerkat/analyzer";

const text = await transcribe(blob, "en");
```

### Text sentiment classification

```ts
import { classifyEmotion } from "@meerkat/analyzer";

const result = await classifyEmotion("I feel amazing today!");
// { mood: "positive", tone: "monotone", valence: 0.97, arousal: 0, confidence: 0.97 }
// Note: arousal is always 0 from DistilBERT — audio features dominate arousal.
```

### Manual fusion

```ts
import {
  transcribe,
  classifyEmotion,
  extractAudioFeatures,
  inferMoodFromAudio,
  fuseEmotionSignals,
} from "@meerkat/analyzer";
import { blobToFloat32 } from "@meerkat/analyzer/utils";

const [text, samples] = await Promise.all([
  transcribe(blob),
  blobToFloat32(blob),
]);
const audioFeatures = extractAudioFeatures(samples);
const [textResult, audioMood] = await Promise.all([
  classifyEmotion(text),
  Promise.resolve(inferMoodFromAudio(audioFeatures)),
]);

// Pass audioFeatures as third arg so fusion can use jitter/shimmer
// for dynamic weighting and stress detection.
const fused = fuseEmotionSignals(textResult!, audioMood, audioFeatures);
// { mood, tone, valence, arousal, confidence, description, contradiction }
```

### Preload models on app start

```ts
import { preloadModels } from "@meerkat/analyzer";

await preloadModels({
  onProgress: (event) => {
    console.log(`[${event.model}] ${event.status}`, event.progress);
  },
});
```

### Check model readiness

```ts
import { isModelLoaded, getModelStatus } from "@meerkat/analyzer";

isModelLoaded(); // true once both models are ready

const { transcription, emotion } = getModelStatus();
// transcription: "idle" | "loading" | "ready" | "error"
// emotion:       "idle" | "loading" | "ready" | "error"
```

---

## React hooks

### `useModelStatus()`

```tsx
import { useModelStatus } from "@meerkat/analyzer";

function ModelBadge() {
  const { transcription, emotion } = useModelStatus();
  if (transcription === "loading" || emotion === "loading")
    return <span>Downloading AI models…</span>;
  return transcription === "ready" && emotion === "ready" ? (
    <span>On-device AI ready ✓</span>
  ) : null;
}
```

### `usePreloadModels()`

```tsx
import { usePreloadModels } from "@meerkat/analyzer";

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const { isReady, events } = usePreloadModels();
  if (!isReady) {
    const latest = events.at(-1);
    return (
      <div>
        <p>Setting up on-device AI…</p>
        {latest && <progress value={latest.progress ?? 0} max={100} />}
      </div>
    );
  }
  return <>{children}</>;
}
```

### `useAnalyzeVoice()`

```tsx
import { useAnalyzeVoice } from "@meerkat/analyzer";

function VoiceControls({ blob }: { blob: Blob | null }) {
  const { analyze, result, isAnalyzing, error } = useAnalyzeVoice({
    language: "en",
  });

  return (
    <div>
      <button
        onClick={() => blob && analyze(blob)}
        disabled={isAnalyzing || !blob}
      >
        {isAnalyzing ? "Analysing…" : "Analyse mood"}
      </button>
      {result && (
        <div>
          <p>
            {result.mood} · {result.tone} ({Math.round(result.confidence * 100)}
            %)
          </p>
          <p>{result.description}</p>
          {result.contradiction && <p>⚠ {result.contradiction} detected</p>}
        </div>
      )}
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

---

## Mood and tone labels

### 3-class mood (from fused valence)

| Mood       | Valence threshold | Meaning                                         |
| ---------- | ----------------- | ----------------------------------------------- |
| `positive` | > 0.3             | Upbeat, optimistic, cheerful                    |
| `negative` | < −0.3            | Downbeat, pessimistic, critical                 |
| `neutral`  | −0.3 to 0.3       | Matter-of-fact, informational, or mixed signals |

### 9-tone system (Russell circumplex quadrants)

Tone is derived from the fused valence + arousal dimensions:

| Arousal       | Positive valence | Negative valence | Neutral valence  |
| ------------- | ---------------- | ---------------- | ---------------- |
| High (> 0.6)  | `energetic`      | `tense`          | `animated`       |
| Mid (0.4–0.6) | `pleasant`       | `serious`        | `conversational` |
| Low (< 0.4)   | `calm`           | `subdued`        | `monotone`       |

---

## Audio features reference

`extractAudioFeatures(samples: Float32Array)` returns an `AudioFeatures` object:

| Field                | Type             | Description                                                                                       |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `pitchMedianHz`      | `number \| null` | Median F0 of voiced frames in Hz. Null if no voiced frames detected.                              |
| `pitchStdDev`        | `number`         | Std dev of F0. High → expressive, variable speech.                                                |
| `energyMean`         | `number`         | Mean RMS energy normalised 0–1. Proxy for perceived loudness.                                     |
| `energyStdDev`       | `number`         | Std dev of frame-level RMS. High → dynamic speech.                                                |
| `speakingRateFPS`    | `number`         | Voiced-onset rate (syllable proxy) in onsets per second.                                          |
| `spectralCentroidHz` | `number`         | Mean spectral centroid of voiced frames. High → brighter timbre.                                  |
| `spectralRolloffHz`  | `number`         | Mean 85th-percentile rolloff.                                                                     |
| `voicedFraction`     | `number`         | Fraction of frames classified as voiced (0–1).                                                    |
| `jitter`             | `number`         | Relative pitch period variation (`pitchStdDev / pitchMedianHz`). > 0.02 indicates voice tremor.   |
| `shimmer`            | `number`         | Relative amplitude variation between consecutive voiced frames. > 0.05 indicates voice shakiness. |
| `pauseDuration`      | `number`         | Fraction of total duration occupied by unvoiced/silent frames (0–1). High → fatigue, hesitancy.   |

---

## Signal fusion

`fuseEmotionSignals(textMood, audioMood, audioFeatures?)` implements the multi-modal fusion algorithm:

### 1. Dynamic signal weighting (default 50/50, range 20–80%)

**Weight text more when:**

- Text sentiment confidence > 90%
- Audio energy is low (quiet recording)
- Voice is monotone (pitch variance < 10 Hz)

**Weight audio more when:**

- Pitch is highly expressive (variance > 40 Hz)
- Jitter is elevated (> 0.02 — voice tremor present)
- Text confidence is low (< 65%)

### 2. Contradiction detection

| Contradiction | Condition                                            | Effect                      |
| ------------- | ---------------------------------------------------- | --------------------------- |
| `sarcasm`     | Positive text + negative prosody, valence diff > 0.7 | Audio weighted to 70%+      |
| `masking`     | Negative text + neutral/positive prosody, diff > 0.5 | Flagged, confidence reduced |
| `stress`      | Neutral text + high jitter or shimmer                | Arousal forced up, flagged  |

### 3. Confidence calculation

- Starts at **50%**
- +25% × text confidence, +15% × audio confidence
- +5% when signals agree on valence sign (bonus), −5% when they diverge (penalty)
- ×0.8 when any contradiction is detected (−20%)

### 4. Description generation

Natural language summaries using all three streams:

```
"Positive mood, energetic tone, high pitched, speaking quickly"
"Neutral mood, tense tone, with long pauses (voice shows tension)"
"Negative mood, monotone tone (possible sarcasm detected)"
```

---

## Architecture

```
@meerkat/analyzer
  ├── analyzeVoice()                ← main entry point (three-stream pipeline)
  │     ├── blobToFloat32()         ← PCM decode + 16kHz resample (shared by all streams)
  │     │
  │     ├── Stream 1: extractAudioFeatures()
  │     │             ├── pitch (autocorrelation/YIN-like)
  │     │             ├── energy (RMS per frame)
  │     │             ├── jitter (pitchStdDev / pitchMedianHz)
  │     │             ├── shimmer (mean |A_i − A_{i-1}| / energyMean)
  │     │             ├── pauseDuration (1 − voicedFraction)
  │     │             └── spectral centroid + rolloff (naive DFT)
  │     │             inferMoodFromAudio() ← rule-based acoustic valence + arousal
  │     │
  │     ├── Stream 3: transcribeSamples()   ← Whisper tiny WASM (reuses decoded PCM)
  │     │             classifyEmotion()     ← DistilBERT SST-2 ONNX
  │     │                                     POSITIVE/NEGATIVE → valence ±score
  │     │
  │     └── Fusion: fuseEmotionSignals()
  │                 ├── dynamic text/audio weighting (20–80%)
  │                 ├── contradiction detection (sarcasm · masking · stress)
  │                 ├── confidence calculation (start 50%, ±agreement, −20% contradiction)
  │                 └── generateDescription() → natural language summary
  │
  ├── lib/
  │   ├── audio-features.ts     ← feature extraction, inferMoodFromAudio, fuseEmotionSignals
  │   ├── model-registry.ts     ← singleton lazy model loaders (wasmPaths, numThreads)
  │   ├── transcription.ts      ← Whisper WASM wrapper (return_timestamps: true for chunking)
  │   ├── emotion.ts            ← DistilBERT SST-2 wrapper (POSITIVE/NEGATIVE → valence)
  │   └── utils.ts              ← classifyMoodFromValence, deriveTone, generateDescription, blobToFloat32
  │
  └── hooks.ts                  ← React hooks (useModelStatus, usePreloadModels, useAnalyzeVoice)
```

---

## Browser setup (Next.js)

The package requires two things wired in `next.config.js`:

**1. COOP/COEP headers** (enables `crossOriginIsolated` for SharedArrayBuffer):

```js
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
    ],
  }];
},
```

**2. ORT WASM local serving** (onnxruntime-web ships a dev pre-release not on any CDN):

`next.config.js` copies `ort-wasm-simd-threaded.{mjs,wasm}` from `node_modules` to `public/ort/` at startup. `model-registry.ts` then sets `env.backends.onnx.wasm.wasmPaths = '/ort/'` so ORT loads them locally instead of hitting the CDN.

The `public/ort/` directory is gitignored — files are regenerated on every `next dev`/`next build` run.

---

## Integration with @meerkat/voice

`@meerkat/voice` calls `analyzeVoice()` immediately after a recording stops, before the blob is encrypted and uploaded. The full `AnalysisResult` — including `audioFeatures`, `description`, and `contradiction` — is stored alongside the `VoiceMemoData` entry in `@meerkat/local-store`.

Acoustic feature extraction completes synchronously from the already-decoded PCM, so basic mood/tone data is available even if the ML models are still loading on a user's first-ever voice note.
