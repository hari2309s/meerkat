# Meerkat UI Components Guide

**Version**: 0.2.0
**Date**: 2026-02-24

---

## Overview

The `@meerkat/ui` package provides React components for building the Meerkat local-first collaborative workspace. All components are built with TypeScript, Tailwind CSS, and Framer Motion for animations.

### New Components (Phase 4)

Four new components have been added to support the local-first P2P architecture:

1. **SyncStatusBadge** - Display P2P sync status
2. **MoodBadge** - Display emotion analysis results
3. **VisitorPresenceList** - Show connected visitors
4. **VoiceRecorderButton** - Voice recording UI with phases

---

## Installation

```bash
# Already installed in the monorepo
pnpm install @meerkat/ui
```

### Peer Dependencies

- `react` ^18.2.0
- `tailwindcss` ^3.4.1

---

## Component Reference

### 1. SyncStatusBadge

Displays the current P2P WebRTC sync status with appropriate icon and color.

#### Import

```tsx
import { SyncStatusBadge } from "@meerkat/ui";
import type { SyncStatus } from "@meerkat/ui";
```

#### Props

| Prop           | Type                        | Default      | Description                             |
| -------------- | --------------------------- | ------------ | --------------------------------------- |
| `status`       | `SyncStatus`                | **Required** | Current sync status                     |
| `showLabel`    | `boolean`                   | `true`       | Show status text                        |
| `showTooltip`  | `boolean`                   | `true`       | Show tooltip on hover                   |
| `visitorCount` | `number`                    | `undefined`  | Number of visitors (shown when hosting) |
| `size`         | `"sm" \| "default" \| "lg"` | `"default"`  | Badge size                              |

#### Status Values

| Status       | Icon               | Color   | Meaning               |
| ------------ | ------------------ | ------- | --------------------- |
| `offline`    | CloudOff           | Gray    | No connection         |
| `connecting` | Loader2 (spinning) | Amber   | Handshake in progress |
| `synced`     | Wifi               | Emerald | Connected and synced  |
| `hosting`    | Users              | Blue    | Hosting with visitors |

#### Usage

```tsx
import { SyncStatusBadge } from "@meerkat/ui";
import { useDenContext } from "@meerkat/crdt";

function DenHeader() {
  const { syncStatus, visitors } = useDenContext();

  return (
    <header className="flex items-center justify-between p-4">
      <h1>My Den</h1>
      <SyncStatusBadge status={syncStatus} visitorCount={visitors.length} />
    </header>
  );
}
```

#### Sizes

```tsx
<SyncStatusBadge status="synced" size="sm" />     {/* Small */}
<SyncStatusBadge status="synced" />               {/* Default */}
<SyncStatusBadge status="synced" size="lg" />     {/* Large */}
```

#### Without Label (Icon Only)

```tsx
<SyncStatusBadge status="synced" showLabel={false} />
```

---

### 2. MoodBadge

Displays detected emotion/mood from voice analysis with emoji and color.

#### Import

```tsx
import { MoodBadge } from "@meerkat/ui";
import type { MoodLabel } from "@meerkat/ui";
```

#### Props

| Prop                 | Type                        | Default      | Description                 |
| -------------------- | --------------------------- | ------------ | --------------------------- |
| `mood`               | `MoodLabel`                 | **Required** | Detected mood               |
| `valence`            | `number`                    | `undefined`  | Valence score (-1 to 1)     |
| `arousal`            | `number`                    | `undefined`  | Arousal score (0 to 1)      |
| `showEmoji`          | `boolean`                   | `true`       | Show mood emoji             |
| `showLabel`          | `boolean`                   | `true`       | Show mood text              |
| `showValenceArousal` | `boolean`                   | `false`      | Show valence/arousal scores |
| `confidence`         | `number`                    | `undefined`  | Confidence score (0 to 1)   |
| `size`               | `"sm" \| "default" \| "lg"` | `"default"`  | Badge size                  |

#### Mood Values

| Mood       | Emoji | Color   | Label     |
| ---------- | ----- | ------- | --------- |
| `happy`    | 😊    | Emerald | Happy     |
| `sad`      | 😢    | Blue    | Sad       |
| `angry`    | 😠    | Red     | Angry     |
| `neutral`  | 😐    | Gray    | Neutral   |
| `fear`     | 😨    | Purple  | Fearful   |
| `surprise` | 😮    | Yellow  | Surprised |
| `disgust`  | 😖    | Orange  | Disgusted |

#### Usage

**Basic**:

```tsx
import { MoodBadge } from "@meerkat/ui";

function VoiceMemoCard({ voiceMemo }: { voiceMemo: VoiceMemoData }) {
  return (
    <div>
      <audio src={voiceMemo.blobUrl} controls />
      <MoodBadge mood={voiceMemo.mood} />
    </div>
  );
}
```

**With Valence/Arousal**:

```tsx
<MoodBadge mood="happy" valence={0.8} arousal={0.6} showValenceArousal />
// Displays: 😊 Happy (+0.80, 0.60)
```

**With Confidence Indicator**:

```tsx
<MoodBadge
  mood="sad"
  confidence={0.55}  {/* Shows low-confidence indicator */}
/>
```

**Emoji Only**:

```tsx
<MoodBadge mood="angry" showLabel={false} />
```

---

### 3. VisitorPresenceList

Displays a list of currently connected P2P visitors with avatars, names, and connection status.

#### Import

```tsx
import { VisitorPresenceList } from "@meerkat/ui";
import type { VisitorInfo } from "@meerkat/ui";
```

#### Props

| Prop                  | Type                   | Default                   | Description                        |
| --------------------- | ---------------------- | ------------------------- | ---------------------------------- |
| `visitors`            | `VisitorInfo[]`        | **Required**              | List of connected visitors         |
| `canDisconnect`       | `boolean`              | `false`                   | Show disconnect button (host only) |
| `onDisconnectVisitor` | `(id: string) => void` | `undefined`               | Callback when disconnect clicked   |
| `showConnectionTime`  | `boolean`              | `true`                    | Show "X mins ago"                  |
| `maxVisible`          | `number`               | `undefined`               | Max visitors before "show more"    |
| `emptyMessage`        | `string`               | `"No visitors connected"` | Empty state text                   |

#### VisitorInfo Type

```typescript
interface VisitorInfo {
  visitorId: string;
  name?: string;
  avatarUrl?: string;
  connectedAt: string; // ISO-8601
  scope?: {
    read: boolean;
    write: boolean;
    offline: boolean;
  };
  lastSeenAt?: number; // Timestamp
}
```

#### Usage

**Basic (Host View)**:

```tsx
import { VisitorPresenceList } from "@meerkat/ui";
import { useDenContext } from "@meerkat/crdt";
import { getP2PManager } from "@meerkat/p2p";

function DenSidebar() {
  const { visitors, syncStatus } = useDenContext();
  const p2p = getP2PManager();

  if (syncStatus !== "hosting") return null;

  return (
    <aside className="w-64 p-4">
      <h2 className="text-lg font-semibold mb-4">Visitors</h2>
      <VisitorPresenceList
        visitors={visitors}
        canDisconnect={true}
        onDisconnectVisitor={(id) => p2p.disconnectVisitor(denId, id)}
      />
    </aside>
  );
}
```

**With Max Visible**:

```tsx
<VisitorPresenceList
  visitors={visitors}
  maxVisible={5}  {/* Show "show more" button if > 5 */}
/>
```

**Custom Empty State**:

```tsx
<VisitorPresenceList visitors={[]} emptyMessage="Waiting for visitors..." />
```

#### Features

- **Animated**: Visitors fade in/out with Framer Motion
- **Read-only indicator**: Shield icon for Peek keys
- **Avatar fallback**: Initials from name or visitor ID
- **Online indicator**: Green dot badge
- **Connection time**: "Just now", "5m ago", "2h ago"
- **Expandable**: Collapse long lists with "show more"

---

### 4. VoiceRecorderButton

Voice recording button with visual feedback for all recording phases.

#### Import

```tsx
import { VoiceRecorderButton } from "@meerkat/ui";
import type { VoiceRecorderPhase } from "@meerkat/ui";
```

#### Props

| Prop             | Type                 | Default      | Description                |
| ---------------- | -------------------- | ------------ | -------------------------- |
| `phase`          | `VoiceRecorderPhase` | **Required** | Current recording phase    |
| `elapsedSeconds` | `number`             | `0`          | Elapsed recording time     |
| `audioUrl`       | `string`             | `undefined`  | Audio blob URL for preview |
| `isPlaying`      | `boolean`            | `false`      | Whether audio is playing   |
| `waveform`       | `number[]`           | `undefined`  | Waveform data (0-1 range)  |
| `onStart`        | `() => void`         | `undefined`  | Start recording callback   |
| `onStop`         | `() => void`         | `undefined`  | Stop recording callback    |
| `onPlayPause`    | `() => void`         | `undefined`  | Play/pause callback        |
| `onSave`         | `() => void`         | `undefined`  | Save recording callback    |
| `onCancel`       | `() => void`         | `undefined`  | Cancel recording callback  |
| `error`          | `string`             | `undefined`  | Error message to display   |
| `disabled`       | `boolean`            | `false`      | Disable all interactions   |

#### Phase Values

| Phase       | UI                                 | Actions                             |
| ----------- | ---------------------------------- | ----------------------------------- |
| `idle`      | Blue mic button                    | `onStart`                           |
| `recording` | Red square button, timer, waveform | `onStop`                            |
| `preview`   | Gray play button, save/cancel      | `onPlayPause`, `onSave`, `onCancel` |
| `saving`    | Spinner, "Saving..." text          | None (disabled)                     |

#### Usage

**Complete Example with `useVoiceRecorder`**:

```tsx
import { VoiceRecorderButton } from "@meerkat/ui";
import { useVoiceRecorder } from "@meerkat/voice";

function ChatInput() {
  const {
    phase,
    seconds,
    audioUrl,
    isPlaying,
    waveform,
    start,
    stop,
    playPause,
    save,
    cancel,
    error,
  } = useVoiceRecorder();

  const handleSave = async () => {
    await save(denId, encryptionKey, async (data, iv) => {
      // Upload encrypted blob
      const { blobRef } = await uploadVoice({ data, iv });
      return blobRef;
    });
  };

  return (
    <div className="flex items-center gap-4">
      <input
        type="text"
        placeholder="Type a message..."
        className="flex-1 px-4 py-2 border rounded-lg"
      />
      <VoiceRecorderButton
        phase={phase}
        elapsedSeconds={seconds}
        audioUrl={audioUrl}
        isPlaying={isPlaying}
        waveform={waveform}
        onStart={start}
        onStop={stop}
        onPlayPause={playPause}
        onSave={handleSave}
        onCancel={cancel}
        error={error}
      />
    </div>
  );
}
```

**Simple (Without Waveform)**:

```tsx
<VoiceRecorderButton
  phase={phase}
  elapsedSeconds={elapsed}
  onStart={() => setPhase("recording")}
  onStop={() => setPhase("preview")}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

#### Visual Features

- **Pulsing animation**: During recording (red pulse)
- **Waveform visualization**: Optional, shows last 30 data points
- **Timer**: Shows `MM:SS` during recording
- **Smooth transitions**: Framer Motion animations between phases
- **Error display**: Shows error message below button

---

## Common Patterns

### Den Header with Sync Status and Visitors

```tsx
import { SyncStatusBadge, VisitorPresenceList } from "@meerkat/ui";
import { useDenContext } from "@meerkat/crdt";

function DenHeader() {
  const { syncStatus, visitors } = useDenContext();

  return (
    <header className="border-b p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Den</h1>
        <SyncStatusBadge status={syncStatus} visitorCount={visitors.length} />
      </div>

      {syncStatus === "hosting" && (
        <VisitorPresenceList
          visitors={visitors}
          canDisconnect={true}
          maxVisible={3}
        />
      )}
    </header>
  );
}
```

### Voice Memo Card with Mood Badge

```tsx
import { MoodBadge } from "@meerkat/ui";
import { useVoicePlayer } from "@meerkat/voice";

function VoiceMemoCard({ memo }: { memo: VoiceMemoData }) {
  const { isPlaying, toggle } = useVoicePlayer(memo.blobUrl);

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={toggle} className="btn-icon">
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <div className="flex-1">
          <p className="text-sm font-medium">{memo.transcript}</p>
          <p className="text-xs text-gray-500">
            {formatDuration(memo.duration)}
          </p>
        </div>
        <MoodBadge
          mood={memo.mood}
          valence={memo.valence}
          arousal={memo.arousal}
          confidence={memo.confidence}
        />
      </div>
    </div>
  );
}
```

### Complete Voice Recording Flow

```tsx
import { VoiceRecorderButton } from "@meerkat/ui";
import { useVoiceRecorder } from "@meerkat/voice";
import { useDenContext } from "@meerkat/crdt";

function VoiceNoteComposer() {
  const { actions } = useDenContext();
  const recorder = useVoiceRecorder();

  const handleSave = async () => {
    await recorder.save(denId, encryptionKey, async (data, iv) => {
      // Upload encrypted blob to Supabase Storage
      const { blobRef } = await uploadVoiceBlob({ data, iv });
      return blobRef;
    });

    // Add to local store
    await actions.createVoiceMemo({
      blobRef: recorder.blobRef,
      duration: recorder.seconds,
      transcript: recorder.transcript,
      mood: recorder.mood,
      valence: recorder.valence,
      arousal: recorder.arousal,
    });
  };

  return (
    <div className="p-6 border-t">
      <VoiceRecorderButton
        phase={recorder.phase}
        elapsedSeconds={recorder.seconds}
        audioUrl={recorder.audioUrl}
        isPlaying={recorder.isPlaying}
        waveform={recorder.waveform}
        onStart={recorder.start}
        onStop={recorder.stop}
        onPlayPause={recorder.playPause}
        onSave={handleSave}
        onCancel={recorder.cancel}
        error={recorder.error}
      />
    </div>
  );
}
```

---

## Styling

### Tailwind Configuration

All components use Tailwind CSS classes. Ensure your `tailwind.config.js` includes the UI package:

```js
// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    // Add this line:
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom colors, animations, etc.
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### Dark Mode

All components support dark mode via Tailwind's `dark:` variant:

```tsx
// Automatically adapts to dark mode
<SyncStatusBadge status="synced" />
<MoodBadge mood="happy" />
<VisitorPresenceList visitors={[...]} />
```

### Custom Styling

All components accept a `className` prop for custom styling:

```tsx
<SyncStatusBadge
  status="synced"
  className="shadow-lg border-2 border-blue-500"
/>

<MoodBadge
  mood="happy"
  className="text-lg px-4 py-2"
/>
```

---

## Accessibility

All components follow WAI-ARIA best practices:

- **Semantic HTML**: Proper use of `<button>`, `<div role="status">`, etc.
- **ARIA labels**: `aria-label`, `aria-hidden` where appropriate
- **Keyboard navigation**: All interactive elements are keyboard-accessible
- **Screen reader support**: Status updates announced via `role="status"`
- **Focus management**: Visible focus indicators

### Examples

```tsx
// Status announced to screen readers
<SyncStatusBadge status="synced" />
// Announces: "Sync status: Synced"

// Mood announced to screen readers
<MoodBadge mood="happy" confidence={0.85} />
// Announces: "Mood: Happy"
// Tooltip: "Happy (85% confidence)"

// Visitor list with proper ARIA
<VisitorPresenceList visitors={[...]} />
// Has role="list", items have role="listitem"
```

---

## Testing

### Unit Tests (Example)

```tsx
import { render, screen } from "@testing-library/react";
import { SyncStatusBadge } from "@meerkat/ui";

test("renders offline status", () => {
  render(<SyncStatusBadge status="offline" />);
  expect(screen.getByText("Offline")).toBeInTheDocument();
});

test("shows visitor count when hosting", () => {
  render(<SyncStatusBadge status="hosting" visitorCount={3} />);
  expect(screen.getByText("Hosting (3)")).toBeInTheDocument();
});
```

### Storybook (Recommended)

Create stories for each component:

```tsx
// SyncStatusBadge.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { SyncStatusBadge } from "@meerkat/ui";

const meta: Meta<typeof SyncStatusBadge> = {
  title: "Meerkat/SyncStatusBadge",
  component: SyncStatusBadge,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Offline: Story = {
  args: { status: "offline" },
};

export const Hosting: Story = {
  args: { status: "hosting", visitorCount: 5 },
};
```

---

## Performance

### Bundle Size

- **SyncStatusBadge**: ~2 KB
- **MoodBadge**: ~2 KB
- **VisitorPresenceList**: ~4 KB (includes Framer Motion)
- **VoiceRecorderButton**: ~5 KB (includes Framer Motion)

### Optimization Tips

1. **Tree-shaking**: Only import what you need

   ```tsx
   import { SyncStatusBadge } from "@meerkat/ui"; // Good
   import * as UI from "@meerkat/ui"; // Bad (imports everything)
   ```

2. **Code splitting**: Use dynamic imports for heavy components

   ```tsx
   const VisitorPresenceList = dynamic(
     () => import("@meerkat/ui").then((m) => m.VisitorPresenceList),
     { ssr: false },
   );
   ```

3. **Memoization**: Memoize visitor lists and callbacks
   ```tsx
   const memoizedVisitors = useMemo(
     () => visitors.map(...),
     [visitors]
   );
   ```

---

## Changelog

### v0.2.0 (2026-02-24)

**Added**:

- ✨ `SyncStatusBadge` component
- ✨ `MoodBadge` component
- ✨ `VisitorPresenceList` component
- ✨ `VoiceRecorderButton` component

**Dependencies**:

- Added `framer-motion` ^11.0.3 for animations

### v0.1.0

**Initial Release**:

- `Button` component
- `Input` component
- `Label` component
- `cn` utility

---

## Support

- **Issues**: [GitHub Issues](https://github.com/hari2309s/meerkat/issues)
- **Docs**: [README.md](./README.md)
- **Examples**: See `apps/web` for usage examples

---

**Built with ❤️ by the Meerkat team**
