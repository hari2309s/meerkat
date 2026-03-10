/**
 * @meerkat/editor — BlockItem
 *
 * Renders and edits a single block. Handles:
 *   - Contenteditable for text blocks
 *   - Keyboard shortcuts (Enter, Backspace, /)
 *   - Block type-specific rendering (headings, lists, code, divider, image…)
 *   - Slash command trigger
 *   - Drag handle
 */

"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import type { BurrowBlock, BurrowBlockType } from "@meerkat/burrows";
import { SlashMenu, type SlashMenuHandle } from "./slash-menu.js";
import type { SlashCommandItem } from "./extensions/slash-commands.js";
import {
  blockContainerClass,
  blockContentClass,
  blockPlaceholder,
  filterBlockTypes,
} from "./utils.js";

export interface BlockItemProps {
  block: BurrowBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  /** Called when the block content changes. */
  onChange: (content: string, extra?: Partial<BurrowBlock>) => void;
  /** Called when Enter is pressed — inserts a new block after this one. */
  onEnter: () => void;
  /** Called when Backspace is pressed on an empty block — merges/deletes. */
  onBackspaceEmpty: () => void;
  /** Called when the block type should change. */
  onTypeChange: (type: BurrowBlockType) => void;
  /** Called when drag-reorder should move this block after `afterId`. */
  onMove: (afterId: string | null) => void;
  readOnly?: boolean;
}

export function BlockItem({
  block,
  isSelected,
  onSelect,
  onChange,
  onEnter,
  onBackspaceEmpty,
  onTypeChange,
  readOnly = false,
}: BlockItemProps) {
  const editRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<SlashMenuHandle>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);

  // ── Sync content into DOM (controlled-like) ──────────────────────────────
  useEffect(() => {
    const el = editRef.current;
    if (!el) return;
    // Only update if the DOM content differs (avoids fighting the user mid-type)
    if (el.textContent !== block.content) {
      el.textContent = block.content;
    }
  }, [block.content]);

  // ── Input handler ─────────────────────────────────────────────────────────
  const handleInput = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    const text = el.textContent ?? "";

    // Detect "/" at the very start of an otherwise empty block
    if (text === "/") {
      setSlashQuery("");
      return;
    }
    if (text.startsWith("/") && slashQuery !== null) {
      setSlashQuery(text.slice(1));
      return;
    }

    // Normal input — close slash menu and persist
    setSlashQuery(null);
    onChange(text);
  }, [onChange, slashQuery]);

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Forward navigation keys to the slash menu when it is open.
      if (slashQuery !== null) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
          const handled = slashMenuRef.current?.onKeyDown({
            event: e.nativeEvent,
          });
          if (handled) {
            e.preventDefault();
            return;
          }
        }

        // Escape: close the menu and remove the "/" text the user typed.
        if (e.key === "Escape") {
          e.preventDefault();
          if (editRef.current) editRef.current.textContent = "";
          onChange("");
          setSlashQuery(null);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        setSlashQuery(null);
        onEnter();
        return;
      }

      if (e.key === "Backspace") {
        const el = editRef.current;
        if (el && (el.textContent ?? "") === "") {
          e.preventDefault();
          setSlashQuery(null);
          onBackspaceEmpty();
          return;
        }
      }
    },
    [onEnter, onBackspaceEmpty, onChange, slashQuery],
  );

  // ── Slash menu selection ──────────────────────────────────────────────────
  const handleSlashSelect = useCallback(
    (type: BurrowBlockType) => {
      setSlashQuery(null);
      // Clear the "/" from the DOM before switching type
      if (editRef.current) editRef.current.textContent = "";
      onChange("");
      onTypeChange(type);
      // Re-focus after state updates
      setTimeout(() => editRef.current?.focus(), 0);
    },
    [onChange, onTypeChange],
  );

  // ── Focus on mount if selected ────────────────────────────────────────────
  useEffect(() => {
    if (isSelected) {
      editRef.current?.focus();
    }
  }, [isSelected]);

  // ── Divider: non-editable ─────────────────────────────────────────────────
  if (block.type === "divider") {
    return (
      <div
        className={blockContainerClass("divider")}
        onClick={onSelect}
        role="separator"
      >
        <hr className="w-full border-t border-border my-2" />
      </div>
    );
  }

  // ── Image block ───────────────────────────────────────────────────────────
  if (block.type === "image") {
    const src = (block.attrs?.src as string | undefined) ?? "";
    const alt = (block.attrs?.alt as string | undefined) ?? "";
    if (src) {
      return (
        <div className={blockContainerClass("image")} onClick={onSelect}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-w-full rounded-md" />
        </div>
      );
    }
    // Fallback: editable URL input
  }

  // ── Text-based blocks ─────────────────────────────────────────────────────
  const containerCls = blockContainerClass(block.type);
  const contentCls = blockContentClass(block.type);

  return (
    <div className={containerCls} onClick={onSelect}>
      {/* ── Drag handle (visible on hover) ── */}
      {!readOnly && (
        <span
          className="flex-none opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-muted-foreground select-none mt-0.5 text-xs"
          aria-hidden
          draggable
        >
          ⠿
        </span>
      )}

      {/* ── Block-type prefix ── */}
      <BlockPrefix block={block} onChange={onChange} readOnly={readOnly} />

      {/* ── Editable content area ── */}
      <div className="relative flex-1 min-w-0">
        <div
          ref={editRef}
          role="textbox"
          aria-multiline
          aria-label={blockPlaceholder(block.type)}
          aria-readonly={readOnly}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          spellCheck
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={onSelect}
          data-placeholder={blockPlaceholder(block.type)}
          className={[
            contentCls,
            // Placeholder via CSS: show when empty
            "before:empty:content-[attr(data-placeholder)] before:empty:text-muted-foreground/50 before:empty:pointer-events-none",
          ].join(" ")}
        />

        {/* ── Slash command menu ── */}
        {slashQuery !== null &&
          (() => {
            const filteredMeta = filterBlockTypes(slashQuery);
            const slashItems: SlashCommandItem[] = filteredMeta.map((meta) => ({
              title: meta.label,
              description: meta.description,
              icon: meta.icon,
              // not called directly — the command prop below handles selection
              command: () => {},
            }));
            return (
              <SlashMenu
                ref={slashMenuRef}
                items={slashItems}
                command={(item) => {
                  const meta = filteredMeta.find((m) => m.label === item.title);
                  if (meta) handleSlashSelect(meta.type);
                }}
              />
            );
          })()}
      </div>
    </div>
  );
}

// ─── BlockPrefix ──────────────────────────────────────────────────────────────

interface BlockPrefixProps {
  block: BurrowBlock;
  onChange: (content: string, extra?: Partial<BurrowBlock>) => void;
  readOnly: boolean;
}

function BlockPrefix({ block, onChange, readOnly }: BlockPrefixProps) {
  switch (block.type) {
    case "bullet":
      return (
        <span
          aria-hidden
          className="flex-none mt-0.5 select-none text-muted-foreground"
        >
          •
        </span>
      );

    case "numbered":
      return null; // counter comes from CSS list-style or parent counter

    case "todo":
      return (
        <input
          type="checkbox"
          checked={block.checked ?? false}
          disabled={readOnly}
          aria-label="Mark as done"
          onChange={(e) =>
            onChange(block.content, { checked: e.target.checked })
          }
          className="flex-none mt-1 h-4 w-4 rounded border-border accent-foreground cursor-pointer"
        />
      );

    case "callout": {
      const emoji = (block.attrs?.emoji as string | undefined) ?? "💡";
      return (
        <span
          aria-hidden
          className="flex-none text-lg select-none leading-relaxed"
        >
          {emoji}
        </span>
      );
    }

    case "toggle":
      return (
        <button
          aria-label="Toggle section"
          className="flex-none mt-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() =>
            onChange(block.content, {
              attrs: { ...block.attrs, open: !(block.attrs?.open ?? true) },
            })
          }
        >
          <span
            className="inline-block transition-transform text-xs"
            style={{
              transform:
                (block.attrs?.open ?? true) ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▸
          </span>
        </button>
      );

    default:
      return null;
  }
}
