/**
 * @meerkat/editor — SlashCommands Tiptap extension
 *
 * Triggered by "/" at the start of an empty block. Shows a floating menu
 * (rendered via Tippy.js) with a filtered list of block types.
 *
 * The menu UI is in `../slash-menu.tsx` — rendered via React Portal into
 * the Tippy popup.
 */

import { Extension, type Editor } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (params: {
    editor: Editor;
    range: { from: number; to: number };
  }) => void;
}

// ─── All available slash commands ─────────────────────────────────────────────

export function buildSlashItems(): SlashCommandItem[] {
  return [
    {
      title: "Text",
      description: "Plain text paragraph",
      icon: "T",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "Heading 1",
      description: "Large section heading",
      icon: "H1",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setHeading({ level: 1 })
          .run();
      },
    },
    {
      title: "Heading 2",
      description: "Medium section heading",
      icon: "H2",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setHeading({ level: 2 })
          .run();
      },
    },
    {
      title: "Heading 3",
      description: "Small section heading",
      icon: "H3",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setHeading({ level: 3 })
          .run();
      },
    },
    {
      title: "Bullet list",
      description: "Unordered list",
      icon: "•",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered list",
      description: "Ordered list",
      icon: "1.",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "To-do list",
      description: "Checkbox items",
      icon: "☐",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "Quote",
      description: "Highlighted blockquote",
      icon: '"',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "Code block",
      description: "Monospace code block",
      icon: "<>",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "Divider",
      description: "Horizontal rule",
      icon: "—",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: "Image",
      description: "Inline image",
      icon: "IMG",
      command: ({ editor, range }) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent({ type: "imageBlock", attrs: { src } })
              .run();
          };
          reader.readAsDataURL(file);
        };
        input.click();
      },
    },
    {
      title: "Voice note",
      description: "Record or insert a voice message",
      icon: "🎙",
      command: ({ editor, range }) => {
        // Insert an empty voice block as placeholder.
        // The web app layer listens for this node and opens the voice recorder.
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "voiceBlock",
            attrs: { audioUrl: null, duration: 0 },
          })
          .run();
      },
    },
  ];
}

export function filterSlashItems(
  items: SlashCommandItem[],
  query: string,
): SlashCommandItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
  );
}

// ─── Extension factory ────────────────────────────────────────────────────────

/**
 * Creates the SlashCommands extension. Pass a `render` function to supply
 * the popup UI (see `createSlashMenuRenderer` in `../slash-menu.tsx`).
 */
export function createSlashCommandsExtension(
  render: SuggestionOptions["render"],
) {
  const allItems = buildSlashItems();

  return Extension.create({
    name: "slashCommands",

    addOptions() {
      return {
        suggestion: {
          char: "/",
          startOfLine: false,
          items: ({ query }: { query: string }) =>
            filterSlashItems(allItems, query),
          render,
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Parameters<SlashCommandItem["command"]>[0]["editor"];
            range: Parameters<SlashCommandItem["command"]>[0]["range"];
            props: SlashCommandItem;
          }) => {
            props.command({ editor, range });
          },
        } satisfies Partial<SuggestionOptions>,
      };
    },

    addProseMirrorPlugins() {
      const { editor: _editor, ...suggestionOpts } = (
        this.options as { suggestion: SuggestionOptions }
      ).suggestion;
      return [
        Suggestion({
          editor: this.editor,
          ...suggestionOpts,
        }),
      ];
    },
  });
}
