/**
 * @meerkat/editor — ImageBlock Tiptap node
 *
 * Extends Tiptap's built-in Image extension with:
 *   - A `caption` attribute
 *   - A React node view that renders `<figure>` + `<figcaption>`
 *   - Editable caption inline
 *   - Selected-state ring
 *
 * Inserted via the "/" slash command ("Image") or by drag-and-drop
 * (drop handling is done by the web app layer).
 */

"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";

// ─── Image block view ─────────────────────────────────────────────────────────

function ImageBlockView({ node, selected, updateAttributes }: NodeViewProps) {
  const { src, alt, caption } = node.attrs as {
    src: string;
    alt: string;
    caption: string;
  };

  return (
    <NodeViewWrapper
      className={[
        "image-block not-prose",
        selected ? "ring-2 ring-offset-2 ring-primary rounded-md" : "",
      ].join(" ")}
      contentEditable={false}
    >
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ""} draggable={false} />
        {/* Editable caption */}
        <figcaption
          contentEditable
          suppressContentEditableWarning
          onInput={(e) =>
            updateAttributes({ caption: e.currentTarget.textContent ?? "" })
          }
          data-placeholder="Add a caption…"
          className="outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50"
        >
          {caption}
        </figcaption>
      </figure>
    </NodeViewWrapper>
  );
}

// ─── Tiptap node definition ───────────────────────────────────────────────────

export const ImageBlock = Node.create({
  name: "imageBlock",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "image-block" }, { tag: "img" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["image-block", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
});
