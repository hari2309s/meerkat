/**
 * @meerkat/editor — VoiceBlock Tiptap node
 *
 * A non-editable leaf node that embeds a recorded voice message.
 * The editor inserts this via the "/" slash command ("Voice note").
 *
 * Attributes:
 *   audioUrl    — URL or blob-ref to the encrypted audio
 *   duration    — Duration in seconds
 *   mood        — Mood label from @meerkat/analyzer (optional)
 *   moodScore   — Valence score 0–1 (optional)
 *   transcript  — Transcript string from Whisper (optional)
 *
 * The web app provides a `renderVoiceBlock` prop to BurrowEditor so it can
 * render the voice player using @meerkat/voice — keeping this package
 * free of audio dependencies.
 */

"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";

// ─── Voice block attributes ───────────────────────────────────────────────────

export interface VoiceBlockAttrs {
  audioUrl: string | null;
  duration: number;
  mood: string | null;
  moodScore: number | null;
  transcript: string | null;
}

// ─── Default view (rendered when no custom renderer is provided) ──────────────

function DefaultVoiceBlockView({ node, selected }: NodeViewProps) {
  const attrs = node.attrs as VoiceBlockAttrs;

  return (
    <NodeViewWrapper
      className={[
        "voice-block not-prose",
        selected ? "ring-2 ring-offset-1 ring-primary" : "",
      ].join(" ")}
      contentEditable={false}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl select-none">🎙</span>
        <div className="flex-1 min-w-0">
          {attrs.audioUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              controls
              src={attrs.audioUrl}
              className="w-full h-8"
              preload="metadata"
            />
          ) : (
            <span className="text-muted-foreground text-sm">
              Voice note (loading…)
            </span>
          )}
          {attrs.duration > 0 && (
            <span className="text-xs text-muted-foreground">
              {Math.round(attrs.duration)}s
            </span>
          )}
        </div>
        {attrs.mood && (
          <span className="flex-none text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {attrs.mood}
          </span>
        )}
      </div>
      {attrs.transcript && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {attrs.transcript}
        </p>
      )}
    </NodeViewWrapper>
  );
}

// ─── Tiptap node definition ───────────────────────────────────────────────────

/**
 * Creates the VoiceBlock Tiptap extension.
 *
 * @param renderView — Optional custom React component for the node view.
 *   Use this to plug in `@meerkat/voice` player components from the web app.
 */
export function createVoiceBlockExtension(
  renderView?: React.ComponentType<NodeViewProps>,
) {
  return Node.create({
    name: "voiceBlock",

    group: "block",

    // Leaf node — no editable content inside
    atom: true,

    draggable: true,

    addAttributes() {
      return {
        audioUrl: { default: null },
        duration: { default: 0 },
        mood: { default: null },
        moodScore: { default: null },
        transcript: { default: null },
      };
    },

    parseHTML() {
      return [{ tag: "voice-block" }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["voice-block", mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      const view = (renderView ?? DefaultVoiceBlockView) as Parameters<
        typeof ReactNodeViewRenderer
      >[0];
      return ReactNodeViewRenderer(view);
    },
  });
}

/** Pre-built extension with the default view. */
export const VoiceBlock = createVoiceBlockExtension();
