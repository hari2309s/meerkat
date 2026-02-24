# @meerkat/analyzer

On-device emotion, mood, and tone detection for Meerkat — from both the audio signal and the transcribed text.

> **No audio or text ever leaves the device.** Audio feature extraction runs from raw PCM with no model or network dependency. Whisper runs in WASM. The emotion classifier runs via ONNX. Both models are downloaded once and cached in the browser's OPFS.

---

## How it works

Analysis uses a **dual-signal pipeline**. The two signals run concurrently and are fused into a single result:

```
audioBlob
  ├── extractAudioFeatures()   ← pitch, energy, speaking rate, spectral (no model, synchronous)
  │     └── inferMoodFromAudio()   ← rule-based acoustic mood signal
  │
  └── transcribe()             ← Whisper tiny WASM (~75 MB)
        └── classifyEmotion()  ← ONNX text classifier (~40 MB)

fuseEmotionSignals(textResult, audioSignal) → AnalysisResult
```

**Why two signals?** Text classification alone misses what the voice reveals. A flat, slow "I'm fine" reads as neutral text but shows low arousal and low valence from pitch and energy analysis. Conversely, very short recordings — a sigh, a hum, two words — give the text classifier almost nothing to work with. The audio signal carries the result in those cases.

| Signal              | What it measures                                                     | Model required                 | Network required |
| ------------------- | -------------------------------------------------------------------- | ------------------------------ | ---------------- |
| Audio features      | Pitch (F0), energy (RMS), speaking rate, spectral centroid & rolloff | None                           | Never            |
| Text classification | Mood label from transcript                                           | Whisper + ONNX (~115 MB total) | First load only  |

---

## What it produces

| Step                     | Model                                        | Size   | What it produces                                |
| ------------------------ | -------------------------------------------- | ------ | ----------------------------------------------- |
| Audio feature extraction | None (autocorrelation + naive DFT)           | 0 MB   | `AudioFeatures` — pitch, energy, rate, spectral |
| Transcription            | Whisper tiny (q8 ONNX)                       | ~75 MB | Plain text transcript                           |
| Emotion classification   | `michellejieli/emotion_text_classifier` (q8) | ~40 MB | `EmotionResult` — MoodLabel + valence/arousal   |
| Fusion                   | Rule-based weighting                         | 0 MB   | Final `AnalysisResult`                          |

Both ML models load lazily on first use and are cached in the browser's Origin Private File System (OPFS). After the initial download, analysis is near-instant. Audio feature extraction is always available with no download at all.

---

## Privacy guarantee

- Audio is decoded to PCM in the browser — the raw bytes never leave the tab.
- Audio feature extraction runs entirely in JavaScript from the decoded PCM — no model, no network.
- Transcription runs via WebAssembly — no network request during inference.
- Emotion classification runs via ONNX — no network request during inference.
- Model weights are fetched from Hugging Face Hub on first use only. After that, all inference is fully offline.

---

## Installation

```bash
pnpm add @meerkat/analyzer
```

---

## Usage

### Full dual-signal pipeline (recommended)

```ts
import { analyzeVoice } from "@meerkat/analyzer";

const result = await analyzeVoice(recordedBlob, { language: "en" });

result.transcript; // "I'm really excited about this project"
result.mood; // "happy"
result.tone; // "energetic"
result.valence; // 0.78   (−1.0 to 1.0, fused from text + audio)
result.arousal; // 0.63   (0.0 to 1.0, fused from text + audio)
result.confidence; // 0.87   (higher when both signals agree)
result.analysedAt; // 1700000000000  (Unix ms)

// Raw acoustic features are also included:
result.audioFeatures?.pitchMedianHz; // 194
result.audioFeatures?.energyMean; // 0.18
result.audioFeatures?.speakingRateFPS; // 4.2
```

### Audio-only mood (no model needed, always available)

Useful before models are loaded, or for very short clips where transcription isn't meaningful.

```ts
import { extractAudioFeatures, inferMoodFromAudio } from "@meerkat/analyzer";
import { blobToFloat32 } from "@meerkat/analyzer/utils";

// Decode the blob to PCM (already done internally by analyzeVoice)
const samples = await blobToFloat32(blob);

// Extract acoustic features
const features = extractAudioFeatures(samples);
// {
//   pitchMedianHz: 182,
//   pitchStdDev: 23.4,
//   energyMean: 0.14,
//   energyStdDev: 0.07,
//   speakingRateFPS: 3.8,
//   spectralCentroidHz: 1340,
//   spectralRolloffHz: 3200,
//   voicedFraction: 0.72
// }

// Infer mood from audio signal alone
const audioMood = inferMoodFromAudio(features);
// { mood: "sad", tone: "negative", valence: -0.41, arousal: 0.18, confidence: 0.61 }
```

### Transcription only

```ts
import { transcribe } from "@meerkat/analyzer";

const text = await transcribe(blob, "en");
```

### Emotion classification from text

```ts
import { classifyEmotion } from "@meerkat/analyzer";

const result = await classifyEmotion("I feel amazing today!");
// { mood: "happy", tone: "energetic", valence: 0.8, arousal: 0.6, confidence: 0.93 }
```

### Manual fusion

If you run the two signals separately and want to combine them yourself:

```ts
import {
  classifyEmotion,
  inferMoodFromAudio,
  fuseEmotionSignals,
  extractAudioFeatures,
} from "@meerkat/analyzer";
import { blobToFloat32 } from "@meerkat/analyzer/utils";

const [text, samples] = await Promise.all([
  transcribe(blob),
  blobToFloat32(blob),
]);
const [textResult, audioFeatures] = await Promise.all([
  classifyEmotion(text),
  Promise.resolve(extractAudioFeatures(samples)),
]);

const audioMood = inferMoodFromAudio(audioFeatures);
const fused = fuseEmotionSignals(textResult!, audioMood);
// { mood, tone, valence, arousal, confidence }
```

### Preload models on app start

```ts
import { preloadModels } from "@meerkat/analyzer";

// Call this after the user's first interaction (to respect autoplay policies).
// Audio feature extraction works immediately — this only downloads the ML models.
await preloadModels({
  onProgress: (event) => {
    console.log(`[${event.model}] ${event.status}`, event.progress);
  },
});
```

### Check model readiness

```ts
import { isModelLoaded, getModelStatus } from "@meerkat/analyzer";

isModelLoaded(); // false (before load), true (after)

const { transcription, emotion } = getModelStatus();
// transcription: "idle" | "loading" | "ready" | "error"
// emotion:       "idle" | "loading" | "ready" | "error"
// Note: audio feature extraction has no load status — it is always ready.
```

---

## React hooks

### `useModelStatus()`

Reactive model status — re-renders when either model's status changes.

```tsx
import { useModelStatus } from "@meerkat/analyzer";

function ModelBadge() {
  const { transcription, emotion } = useModelStatus();

  if (transcription === "loading" || emotion === "loading") {
    return <span>Downloading AI models…</span>;
  }
  return transcription === "ready" && emotion === "ready" ? (
    <span>On-device AI ready ✓</span>
  ) : null;
}
```

### `usePreloadModels()`

Preloads both models with progress tracking.

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

Stable analyze function with state tracking. Uses the full dual-signal pipeline.

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
            % confident)
          </p>
          {result.audioFeatures?.pitchMedianHz && (
            <p>Pitch: {Math.round(result.audioFeatures.pitchMedianHz)} Hz</p>
          )}
        </div>
      )}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

---

## Mood label → dimensions

The emotion classifier outputs one of 7 discrete mood labels. The package maps each to valence/arousal using the Russell circumplex model of affect. The audio signal's valence/arousal estimates are then fused with these values.

| Mood      | Valence | Arousal | Tone          |
| --------- | ------- | ------- | ------------- |
| happy     | +0.8    | +0.6    | energetic     |
| sad       | −0.7    | −0.4    | negative      |
| angry     | −0.6    | +0.8    | tense         |
| fearful   | −0.6    | +0.6    | tense         |
| disgusted | −0.5    | +0.2    | calm/negative |
| surprised | +0.2    | +0.8    | energetic     |
| neutral   | 0.0     | 0.0     | neutral       |

---

## Audio features reference

`extractAudioFeatures(samples: Float32Array)` returns an `AudioFeatures` object:

| Field                | Type             | Description                                                                     |
| -------------------- | ---------------- | ------------------------------------------------------------------------------- |
| `pitchMedianHz`      | `number \| null` | Median F0 of voiced frames in Hz. Null if no voiced frames detected.            |
| `pitchStdDev`        | `number`         | Std dev of F0 across voiced frames. High → expressive/variable speech.          |
| `energyMean`         | `number`         | Mean RMS energy normalised 0–1. Proxy for perceived loudness.                   |
| `energyStdDev`       | `number`         | Std dev of frame-level RMS. High → dynamic, engaged speech.                     |
| `speakingRateFPS`    | `number`         | Voiced-onset rate (syllable proxy) in onsets per second.                        |
| `spectralCentroidHz` | `number`         | Mean spectral centroid of voiced frames. High → brighter, sharper timbre.       |
| `spectralRolloffHz`  | `number`         | Mean 85th-percentile rolloff. Correlates with brightness and consonant voicing. |
| `voicedFraction`     | `number`         | Fraction of frames classified as voiced (0–1). Very low → whisper or silence.   |

---

## Signal fusion

`fuseEmotionSignals(textResult, audioMood)` combines the two signals with dynamic weights:

- Text result is weighted **0.50 – 0.75** (higher when text confidence is high).
- Audio signal fills the remaining weight, emphasising arousal detection.
- When both signals agree on the arousal quadrant and valence sign, a small confidence **bonus** is applied.
- When they diverge, a small **penalty** reduces confidence, reflecting genuine ambiguity.
- When the transcript is empty or too short, the audio-only result is returned directly (no fusion).

---

## Architecture

```
@meerkat/analyzer
  ├── analyzeVoice()              ← main entry point (dual-signal pipeline)
  │     ├── blobToFloat32()       ← PCM decode (shared by both signals)
  │     ├── extractAudioFeatures() ← pitch, energy, rate, spectral (no model)
  │     │     └── inferMoodFromAudio() ← rule-based acoustic mood
  │     ├── transcribeSamples()   ← Whisper WASM (reuses decoded PCM)
  │     │     └── classifyEmotion() ← ONNX text classifier
  │     └── fuseEmotionSignals()  ← weighted fusion
  │
  ├── lib/
  │   ├── audio-features.ts       ← acoustic feature extraction & fusion
  │   ├── model-registry.ts       ← singleton lazy model loaders
  │   ├── transcription.ts        ← Whisper wrapper
  │   ├── emotion.ts              ← emotion classifier wrapper
  │   └── utils.ts                ← label mapping, audio utils (pure)
  │
  └── hooks.ts                    ← React hooks (useModelStatus, etc.)
```

---

## Integration with @meerkat/voice

`@meerkat/voice` calls `analyzeVoice()` immediately after a recording stops, before the blob is encrypted and uploaded. The `AnalysisResult` — including `audioFeatures` — is stored alongside the `VoiceMemoData` entry in `@meerkat/local-store`.

Audio feature extraction completes synchronously from the already-decoded PCM, so basic mood/tone data is available even if the ML models are still loading on a user's first-ever voice note.
