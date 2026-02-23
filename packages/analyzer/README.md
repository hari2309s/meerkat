# @meerkat/analyzer

On-device voice transcription and emotion analysis for Meerkat.

> **No audio or text ever leaves the device.** Whisper runs in WASM. The emotion classifier runs via ONNX. Both models are downloaded once and cached in the browser's OPFS.

---

## What it does

| Step                   | Model                                        | Size   | What it produces            |
| ---------------------- | -------------------------------------------- | ------ | --------------------------- |
| Transcription          | Whisper tiny (q8 ONNX)                       | ~75 MB | Plain text transcript       |
| Emotion classification | `michellejieli/emotion_text_classifier` (q8) | ~40 MB | MoodLabel + valence/arousal |

Both models load lazily on first use and are cached in the browser's Origin Private File System (OPFS). After the initial download, analysis is near-instant.

---

## Privacy guarantee

- Audio is decoded to PCM in the browser — the raw bytes never leave the tab.
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

### Full pipeline (recommended)

```ts
import { analyzeVoice } from "@meerkat/analyzer";

// Pass the Blob from MediaRecorder
const result = await analyzeVoice(recordedBlob, { language: "en" });

result.transcript; // "I'm really excited about this project"
result.mood; // "happy"
result.tone; // "energetic"
result.valence; // 0.8    (−1.0 to 1.0)
result.arousal; // 0.6    (0.0 to 1.0)
result.confidence; // 0.91   (0.0 to 1.0)
result.analysedAt; // 1700000000000  (Unix ms)
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

### Preload models on app start

```ts
import { preloadModels } from "@meerkat/analyzer";

// Call this after the user's first interaction (to respect autoplay policies)
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

Stable analyze function with state tracking.

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
        <p>
          {result.mood} ({Math.round(result.confidence * 100)}% confident)
        </p>
      )}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}
```

---

## Mood label → dimensions

The emotion classifier outputs one of 7 discrete mood labels. The package maps each to valence/arousal using the Russell circumplex model of affect.

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

## Architecture

```
@meerkat/analyzer
  ├── analyzeVoice()          ← main entry point
  │     ├── transcribe()      ← Whisper WASM pipeline
  │     └── classifyEmotion() ← ONNX emotion pipeline
  │
  ├── lib/
  │   ├── model-registry.ts   ← singleton lazy model loaders
  │   ├── transcription.ts    ← Whisper wrapper
  │   ├── emotion.ts          ← emotion classifier wrapper
  │   └── utils.ts            ← label mapping, audio utils (pure)
  │
  └── hooks.ts                ← React hooks (useModelStatus, etc.)
```

---

## Integration with @meerkat/voice

`@meerkat/voice` calls `analyzeVoice()` immediately after a recording stops, before the blob is encrypted and uploaded. The `AnalysisResult` is stored alongside the `VoiceMemoData` entry in `@meerkat/local-store`.

```ts
// Inside @meerkat/voice (simplified)
const blob = await stopRecording();
const analysis = await analyzeVoice(blob); // ← this package
const encryptedBlob = await encryptBlob(blob, key); // ← @meerkat/crypto
const blobRef = await uploadToStorage(encryptedBlob);
await addVoiceMemo(denId, blobRef, duration, analysis); // ← @meerkat/local-store
```
