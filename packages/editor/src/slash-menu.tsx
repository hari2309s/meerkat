/**
 * @meerkat/editor — SlashMenu + Tippy renderer
 *
 * The SlashMenu component renders the floating slash command popup.
 * `createSlashMenuRenderer` wires it into Tiptap Suggestion via Tippy.js.
 */

"use client";

import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { SlashCommandItem } from "./extensions/slash-commands.js";

// ─── SlashMenu component ──────────────────────────────────────────────────────

export interface SlashMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface SlashMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [activeIdx, setActiveIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setActiveIdx(0);
    }, [items]);

    useEffect(() => {
      const el = containerRef.current?.children[activeIdx] as
        | HTMLElement
        | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }, [activeIdx]);

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: { event: KeyboardEvent }) {
        if (event.key === "ArrowDown") {
          setActiveIdx((i) => Math.min(i + 1, items.length - 1));
          return true;
        }
        if (event.key === "ArrowUp") {
          setActiveIdx((i) => Math.max(i - 1, 0));
          return true;
        }
        if (event.key === "Enter") {
          const item = items[activeIdx];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="px-4 py-3 text-sm text-muted-foreground">
          No results
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="flex flex-col p-1"
        role="listbox"
        aria-label="Block type selector"
      >
        {items.map((item, i) => (
          <button
            key={item.title}
            role="option"
            aria-selected={i === activeIdx}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              command(item);
            }}
            className={[
              "flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
              i === activeIdx
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50 text-foreground",
            ].join(" ")}
          >
            <span className="flex-none w-8 h-8 flex items-center justify-center rounded-md bg-muted text-xs font-mono font-bold text-muted-foreground">
              {item.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium leading-tight">
                {item.title}
              </span>
              <span className="block text-xs text-muted-foreground truncate">
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  },
);
SlashMenu.displayName = "SlashMenu";

// ─── Tippy renderer wiring ────────────────────────────────────────────────────

/**
 * Returns the `render` function required by Tiptap Suggestion.
 * Mounts the `SlashMenu` React component into a Tippy.js popup.
 */
export function createSlashMenuRenderer() {
  return () => {
    let component: ReactRenderer<SlashMenuHandle, SlashMenuProps>;
    let popup: TippyInstance[];

    return {
      onStart(props: { items: SlashCommandItem[]; clientRect?: (() => DOMRect | null) | null; command: (item: SlashCommandItem) => void; editor: unknown }) {
        component = new ReactRenderer(SlashMenu, {
          props,
          editor: props.editor as ConstructorParameters<typeof ReactRenderer>[1]["editor"],
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          theme: "meerkat-slash",
          maxWidth: "280px",
          // Light shadow that works with both light and dark themes
          popperOptions: {
            modifiers: [{ name: "flip", options: { fallbackPlacements: ["top-start"] } }],
          },
        });
      },

      onUpdate(props: { items: SlashCommandItem[]; clientRect?: (() => DOMRect | null) | null; command: (item: SlashCommandItem) => void }) {
        component.updateProps(props);

        if (!props.clientRect) return;
        popup[0]?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          popup[0]?.hide();
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        popup[0]?.destroy();
        component.destroy();
      },
    };
  };
}
