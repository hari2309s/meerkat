/**
 * @meerkat/editor — BurrowEditor
 *
 * Tiptap-based block editor with Yjs collaboration.
 *
 * Usage:
 *
 *   import { BurrowEditor } from '@meerkat/editor';
 *   import { useBurrow, useBurrowDoc } from '@meerkat/burrows';
 *
 *   function EditorPage({ denId, burrowId }) {
 *     const { burrow, actions } = useBurrow(denId, burrowId);
 *     const { doc } = useBurrowDoc(burrow?.yjsDocId);
 *
 *     if (!burrow || !doc) return <Spinner />;
 *
 *     return (
 *       <BurrowEditor
 *         doc={doc}
 *         user={{ name: currentUser.name, color: '#7c3aed' }}
 *         title={burrow.title}
 *         icon={burrow.icon}
 *         onTitleChange={(t) => actions.updateBurrow({ title: t })}
 *       />
 *     );
 *   }
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import * as Y from "yjs";
import { createSlashCommandsExtension } from "./extensions/slash-commands.js";
import { createSlashMenuRenderer } from "./slash-menu.js";
import {
  VoiceBlock,
  createVoiceBlockExtension,
} from "./extensions/voice-block.js";
import { ImageBlock } from "./extensions/image-block.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal provider interface — matches Tiptap CollaborationCursor's expectation. */
export interface CollaborationProvider {
  awareness: {
    setLocalStateField(key: string, value: unknown): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
    getStates(): Map<number, Record<string, unknown>>;
  };
}

export interface EditorUser {
  name: string;
  color: string;
}

export interface BurrowEditorProps {
  /** The Y.Doc from `useBurrowDoc(burrow.yjsDocId)`. */
  doc: Y.Doc;
  /**
   * Awareness provider for collaboration cursors.
   * Pass the P2P provider's awareness when in a hosted den.
   * Omit for single-user / offline editing.
   */
  provider?: CollaborationProvider;
  /** Display name and cursor colour for the current user. */
  user: EditorUser;

  /** Page title shown above the editor. */
  title?: string;
  /** Page icon (emoji). */
  icon?: string;
  /** Called when the title changes. */
  onTitleChange?: (title: string) => void;
  /** Called when the icon changes. */
  onIconChange?: (icon: string) => void;

  /**
   * Called on every content update, debounced ~500ms.
   * Use to update BurrowMetadata (word count, etc.).
   */
  onUpdate?: (params: {
    wordCount: number;
    hasVoiceNotes: boolean;
    hasImages: boolean;
  }) => void;

  /**
   * Custom React component for rendering voice blocks.
   * Defaults to a plain `<audio>` element.
   * Supply a `@meerkat/voice` player here from the web app.
   */
  renderVoiceBlock?: React.ComponentType<NodeViewProps>;

  /** When true, the editor is read-only. */
  readOnly?: boolean;

  className?: string;
}

// ─── IconPickerModal ──────────────────────────────────────────────────────────

function IconPickerModal({
  current,
  onConfirm,
  onClose,
}: {
  current: string;
  onConfirm: (icon: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "rgba(0,0,0,0.52)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "22rem",
          borderRadius: "1rem",
          padding: "1.5rem",
          background: "var(--color-bg-card)",
          border: "1.5px solid var(--color-border-card)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview */}
        <div
          style={{
            fontSize: "3.5rem",
            lineHeight: 1,
            textAlign: "center",
            marginBottom: "1rem",
            userSelect: "none",
          }}
        >
          {value || current}
        </div>

        <p
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            marginBottom: "0.5rem",
            color: "var(--color-text-secondary)",
          }}
        >
          Page icon
        </p>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
          }}
          placeholder="Paste an emoji…"
          style={{
            width: "100%",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.625rem",
            border: "1.5px solid var(--color-border-card)",
            background: "transparent",
            color: "var(--color-text-primary)",
            fontSize: "1.25rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            marginTop: "1rem",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.375rem 0.875rem",
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
              color: "var(--color-text-muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => value.trim() && onConfirm(value.trim())}
            style={{
              padding: "0.375rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              background: "var(--color-text-primary)",
              color: "var(--color-bg-base)",
              border: "none",
              cursor: "pointer",
              opacity: value.trim() ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return modal;
}

// ─── BurrowEditor ─────────────────────────────────────────────────────────────

export function BurrowEditor({
  doc,
  provider,
  user,
  title = "",
  icon,
  onTitleChange,
  onIconChange,
  onUpdate,
  renderVoiceBlock,
  readOnly = false,
  className = "",
}: BurrowEditorProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Build the VoiceBlock extension (with optional custom renderer)
  const voiceBlockExtension = renderVoiceBlock
    ? createVoiceBlockExtension(renderVoiceBlock)
    : VoiceBlock;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable history — Yjs provides undo/redo via its own undo manager
        history: false,
      }),

      // Yjs collaboration — reads/writes the Y.XmlFragment "default" in `doc`
      Collaboration.configure({ document: doc }),

      // Collaboration cursors (only when a provider is given)
      ...(provider
        ? [
            CollaborationCursor.configure({
              provider,
              user: { name: user.name, color: user.color },
            }),
          ]
        : []),

      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `Heading ${(node.attrs as { level: number }).level}`;
          }
          return "Type something, or press / for commands…";
        },
      }),

      TaskList,
      TaskItem.configure({ nested: true }),

      // Slash commands with Tippy popup
      createSlashCommandsExtension(createSlashMenuRenderer()),

      // Custom nodes
      voiceBlockExtension,
      ImageBlock,
    ],

    editable: !readOnly,

    onUpdate({ editor: ed }) {
      // Debounce stat reporting
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = setTimeout(() => {
        const text = ed.getText();
        const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
        const json = ed.getJSON();
        const content = (json.content ?? []) as Array<{ type?: string }>;
        const hasVoiceNotes = content.some((n) => n.type === "voiceBlock");
        const hasImages = content.some(
          (n) => n.type === "imageBlock" || n.type === "image",
        );
        onUpdate?.({ wordCount: words, hasVoiceNotes, hasImages });
      }, 500);
    },
  });

  // Sync editor editable state when readOnly prop changes
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Sync title into DOM
  useEffect(() => {
    if (titleRef.current && titleRef.current.textContent !== title) {
      titleRef.current.textContent = title;
    }
  }, [title]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    };
  }, []);

  const handleTitleInput = useCallback(() => {
    const text = titleRef.current?.textContent ?? "";
    onTitleChange?.(text);
  }, [onTitleChange]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        editor?.commands.focus("start");
      }
    },
    [editor],
  );

  return (
    <div
      className={[
        "meerkat-editor w-full max-w-3xl mx-auto px-6 py-10",
        className,
      ].join(" ")}
    >
      {/* ── Page header ── */}
      <div className="mb-8">
        {/* Icon */}
        {!readOnly && (
          <div
            className="mb-3 text-5xl leading-none cursor-pointer select-none"
            title="Change icon"
            onClick={() => setIconPickerOpen(true)}
          >
            {icon ?? "📄"}
          </div>
        )}
        {iconPickerOpen && (
          <IconPickerModal
            current={icon ?? "📄"}
            onConfirm={(next) => {
              onIconChange?.(next);
              setIconPickerOpen(false);
            }}
            onClose={() => setIconPickerOpen(false)}
          />
        )}
        {readOnly && icon && (
          <div className="mb-3 text-5xl leading-none select-none">{icon}</div>
        )}

        {/* Title */}
        <div
          ref={titleRef}
          role="heading"
          aria-level={1}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          spellCheck
          data-placeholder="Untitled"
          onInput={handleTitleInput}
          onKeyDown={handleTitleKeyDown}
          className="text-4xl font-bold text-foreground leading-tight outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none"
        />
      </div>

      {/* ── Tiptap editor ── */}
      <EditorContent editor={editor} className="min-h-32 text-foreground" />
    </div>
  );
}
