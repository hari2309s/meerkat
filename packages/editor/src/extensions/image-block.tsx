/**
 * @meerkat/editor — ImageBlock Tiptap node
 *
 * Extends Tiptap's built-in Image extension with:
 *   - A `caption` attribute
 *   - A React node view that renders a thumbnail + full-screen lightbox on click
 *   - Editable caption inline
 *   - Selected-state ring
 *
 * Inserted via the "/" slash command ("Image") or by drag-and-drop
 * (drop handling is done by the web app layer).
 */

"use client";

import { useState, useEffect } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";

// ─── Inline lightbox (no external deps) ──────────────────────────────────────

function InlineLightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  caption: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.9)",
        backdropFilter: "blur(12px)",
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          background: "rgba(255,255,255,0.1)",
          border: "none",
          borderRadius: "9999px",
          width: "2rem",
          height: "2rem",
          cursor: "pointer",
          color: "rgba(255,255,255,0.8)",
          fontSize: "1.1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ✕
      </button>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          padding: "2rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            maxHeight: "calc(100vh - 8rem)",
            maxWidth: "min(90vw, 900px)",
            borderRadius: "0.75rem",
            objectFit: "contain",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          }}
        />
        {caption && (
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: "0.875rem",
              textAlign: "center",
              maxWidth: "32rem",
            }}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Image block view ─────────────────────────────────────────────────────────

function ImageBlockView({ node, selected }: NodeViewProps) {
  const { src, alt, caption } = node.attrs as {
    src: string;
    alt: string;
    caption: string;
  };
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <NodeViewWrapper className="image-block not-prose" contentEditable={false}>
      <figure>
        {/* Thumbnail — click to open lightbox */}
        <div
          style={{
            position: "relative",
            display: "inline-block",
            cursor: "zoom-in",
            transform: selected ? "scale(1.03)" : "scale(1)",
            transition: "transform 150ms ease",
            transformOrigin: "top left",
          }}
          className="group"
          onClick={() => setLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt ?? ""}
            draggable={false}
            style={{
              maxHeight: "320px",
              maxWidth: "100%",
              display: "block",
              borderRadius: "0.5rem",
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-lg"
            style={{ background: "rgba(0,0,0,0.28)" }}
          >
            <span
              style={{
                color: "white",
                fontSize: "1.5rem",
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
              }}
            >
              ⊕
            </span>
          </div>
        </div>

        {/* Caption — displayed as text; not contentEditable to avoid
            stealing focus from ProseMirror's outer contenteditable */}
        {caption ? <figcaption>{caption}</figcaption> : null}
      </figure>

      {lightboxOpen && (
        <InlineLightbox
          src={src}
          alt={alt ?? ""}
          caption={caption ?? ""}
          onClose={() => setLightboxOpen(false)}
        />
      )}
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
