"use client";

import { useEditor, EditorContent, InputRule } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ResolvedPos, MarkType } from "@tiptap/pm/model";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/** Convert stored plain-text / legacy markdown to HTML for tiptap's initial load. */
function toHtml(value: string): string {
  if (!value) return "";
  if (value.trimStart().startsWith("<")) return value; // already HTML from tiptap
  return value
    .split(/\n\n+/)
    .map((para) => {
      const safe = para
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<p>${safe.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

/**
 * Find the full from/to extent of a link mark around the given position.
 * Walks left and right from the child node containing $pos.
 */
function getMarkExtent(
  $pos: ResolvedPos,
  markType: MarkType,
  href: string
): { from: number; to: number } | null {
  const { parent } = $pos;
  const parentOffset = $pos.parentOffset;
  const blockStart = $pos.start();

  let offset = 0;
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    const end = offset + child.nodeSize;

    if (offset <= parentOffset && parentOffset <= end) {
      const linkMark = child.marks.find(
        (m) => m.type === markType && m.attrs.href === href
      );
      if (!linkMark || !child.isText) {
        offset = end;
        continue;
      }

      let startOffset = offset;
      let endOffset = end;

      // Walk left
      for (let j = i - 1; j >= 0; j--) {
        if (!linkMark.isInSet(parent.child(j).marks)) break;
        startOffset -= parent.child(j).nodeSize;
      }
      // Walk right
      for (let j = i + 1; j < parent.childCount; j++) {
        if (!linkMark.isInSet(parent.child(j).marks)) break;
        endOffset += parent.child(j).nodeSize;
      }

      return { from: blockStart + startOffset, to: blockStart + endOffset };
    }

    offset = end;
  }
  return null;
}

/** ProseMirror plugin: show raw [text](url) brackets when cursor is inside a link */
const linkRawPlugin = new Plugin({
  key: new PluginKey("linkRaw"),
  props: {
    decorations(state) {
      if (typeof window === "undefined") return DecorationSet.empty;
      const { selection } = state;
      if (!selection.empty) return DecorationSet.empty;

      const { $from } = selection;
      const linkMark = $from.marks().find((m) => m.type.name === "link");
      if (!linkMark) return DecorationSet.empty;

      const href = linkMark.attrs.href as string;
      const range = getMarkExtent($from, linkMark.type, href);
      if (!range) return DecorationSet.empty;

      const open = document.createElement("span");
      open.className = "link-raw-syntax";
      open.textContent = "[";

      const close = document.createElement("span");
      close.className = "link-raw-syntax";
      close.textContent = `](${href})`;

      return DecorationSet.create(state.doc, [
        Decoration.widget(range.from, open, { side: -1 }),
        Decoration.widget(range.to, close),
      ]);
    },
  },
});

/**
 * Link extension extended with:
 * - Input rule: [text](url) → link mark
 * - Decoration plugin: show raw syntax when cursor is inside link
 */
const MarkdownLink = Link.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /\[(.+?)\]\((.+?)\)$/,
        handler: ({ state, range, match }) => {
          const displayText = match[1];
          const href = match[2];
          if (!displayText || !href) return;
          const { tr } = state;
          tr.replaceWith(
            range.from,
            range.to,
            state.schema.text(displayText, [this.type.create({ href })])
          );
          tr.removeStoredMark(this.type);
        },
      }),
    ];
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), linkRawPlugin];
  },
}).configure({
  openOnClick: false,
  autolink: false,
  HTMLAttributes: {
    rel: null,
    target: null,
  },
});

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Type something…" }),
      MarkdownLink,
    ],
    content: toHtml(value),
    editorProps: {
      attributes: { class: "tiptap-prose outline-none" },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className="tiptap-editor min-h-[160px]">
      <EditorContent editor={editor} />
    </div>
  );
}
