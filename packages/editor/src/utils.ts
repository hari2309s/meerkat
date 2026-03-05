/**
 * @meerkat/editor — utilities
 */

import type { BurrowBlockType } from "@meerkat/burrows";

// ─── Block type display metadata ─────────────────────────────────────────────

export interface BlockTypeMeta {
  type: BurrowBlockType;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
}

export const BLOCK_TYPE_META: BlockTypeMeta[] = [
  {
    type: "paragraph",
    label: "Text",
    description: "Plain text paragraph",
    icon: "T",
    shortcut: "/text",
  },
  {
    type: "heading1",
    label: "Heading 1",
    description: "Large section heading",
    icon: "H1",
    shortcut: "/h1",
  },
  {
    type: "heading2",
    label: "Heading 2",
    description: "Medium section heading",
    icon: "H2",
    shortcut: "/h2",
  },
  {
    type: "heading3",
    label: "Heading 3",
    description: "Small section heading",
    icon: "H3",
    shortcut: "/h3",
  },
  {
    type: "bullet",
    label: "Bullet list",
    description: "Unordered list item",
    icon: "•",
    shortcut: "/bullet",
  },
  {
    type: "numbered",
    label: "Numbered list",
    description: "Ordered list item",
    icon: "1.",
    shortcut: "/numbered",
  },
  {
    type: "todo",
    label: "To-do",
    description: "Checkbox item",
    icon: "☐",
    shortcut: "/todo",
  },
  {
    type: "quote",
    label: "Quote",
    description: "Highlighted blockquote",
    icon: '"',
    shortcut: "/quote",
  },
  {
    type: "code",
    label: "Code",
    description: "Code block with monospace font",
    icon: "<>",
    shortcut: "/code",
  },
  {
    type: "callout",
    label: "Callout",
    description: "Highlighted panel with an icon",
    icon: "!",
    shortcut: "/callout",
  },
  {
    type: "toggle",
    label: "Toggle",
    description: "Collapsible section",
    icon: "▸",
    shortcut: "/toggle",
  },
  {
    type: "divider",
    label: "Divider",
    description: "Horizontal rule",
    icon: "—",
    shortcut: "/divider",
  },
  {
    type: "image",
    label: "Image",
    description: "Inline image",
    icon: "IMG",
    shortcut: "/image",
  },
];

/**
 * Filters block type options by a slash-command query string.
 * e.g. query="head" returns heading1, heading2, heading3.
 */
export function filterBlockTypes(query: string): BlockTypeMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return BLOCK_TYPE_META;
  return BLOCK_TYPE_META.filter(
    (m) =>
      m.label.toLowerCase().includes(q) ||
      m.type.toLowerCase().includes(q) ||
      (m.shortcut?.slice(1).includes(q) ?? false),
  );
}

// ─── Block placeholder text ───────────────────────────────────────────────────

export function blockPlaceholder(type: BurrowBlockType): string {
  switch (type) {
    case "heading1":
      return "Heading 1";
    case "heading2":
      return "Heading 2";
    case "heading3":
      return "Heading 3";
    case "bullet":
      return "List item";
    case "numbered":
      return "List item";
    case "todo":
      return "To-do";
    case "quote":
      return "Quote";
    case "code":
      return "Code";
    case "callout":
      return "Callout text";
    case "toggle":
      return "Toggle heading";
    case "divider":
      return "";
    case "image":
      return "Image URL";
    default:
      return "Type something, or press / for commands";
  }
}

// ─── CSS class helpers ────────────────────────────────────────────────────────

export function blockContainerClass(type: BurrowBlockType): string {
  const base = "group relative flex items-start gap-2 w-full";
  switch (type) {
    case "heading1":
      return `${base} mt-6`;
    case "heading2":
      return `${base} mt-4`;
    case "heading3":
      return `${base} mt-3`;
    case "divider":
      return `${base} my-2`;
    default:
      return `${base} my-0.5`;
  }
}

export function blockContentClass(type: BurrowBlockType): string {
  switch (type) {
    case "heading1":
      return "text-3xl font-bold text-foreground leading-tight flex-1 min-w-0 outline-none";
    case "heading2":
      return "text-2xl font-semibold text-foreground leading-snug flex-1 min-w-0 outline-none";
    case "heading3":
      return "text-xl font-medium text-foreground leading-snug flex-1 min-w-0 outline-none";
    case "quote":
      return "flex-1 min-w-0 outline-none italic text-muted-foreground border-l-2 border-foreground/30 pl-4 py-1";
    case "code":
      return "flex-1 min-w-0 outline-none font-mono text-sm bg-muted rounded-md px-3 py-2 text-foreground whitespace-pre";
    case "callout":
      return "flex-1 min-w-0 outline-none text-foreground";
    default:
      return "flex-1 min-w-0 outline-none text-foreground leading-relaxed";
  }
}
