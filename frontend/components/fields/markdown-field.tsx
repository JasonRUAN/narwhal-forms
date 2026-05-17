"use client";

import * as React from "react";
import {
  CodeIcon,
  Heading02Icon,
  LeftToRightBlockQuoteIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link02Icon,
  PencilEdit02Icon,
  TextBoldIcon,
  TextItalicIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";

import { Icon } from "@/components/icon";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

interface MarkdownFieldProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

type ToolbarAction =
  | { kind: "wrap"; before: string; after: string; placeholder: string }
  | { kind: "linePrefix"; prefix: string; placeholder: string }
  | { kind: "link" };

interface ToolbarItem {
  id: string;
  label: string; // tooltip + a11y label
  icon: Parameters<typeof Icon>[0]["icon"];
  shortcut?: string; // visual hint only
  action: ToolbarAction;
}

const TOOLBAR: ToolbarItem[] = [
  {
    id: "bold",
    label: "Bold",
    icon: TextBoldIcon,
    shortcut: "⌘B",
    action: { kind: "wrap", before: "**", after: "**", placeholder: "bold text" },
  },
  {
    id: "italic",
    label: "Italic",
    icon: TextItalicIcon,
    shortcut: "⌘I",
    action: { kind: "wrap", before: "*", after: "*", placeholder: "italic text" },
  },
  {
    id: "code",
    label: "Inline code",
    icon: CodeIcon,
    shortcut: "⌘E",
    action: { kind: "wrap", before: "`", after: "`", placeholder: "code" },
  },
  {
    id: "heading",
    label: "Heading",
    icon: Heading02Icon,
    action: { kind: "linePrefix", prefix: "## ", placeholder: "Heading" },
  },
  {
    id: "quote",
    label: "Quote",
    icon: LeftToRightBlockQuoteIcon,
    action: { kind: "linePrefix", prefix: "> ", placeholder: "quoted text" },
  },
  {
    id: "ul",
    label: "Bulleted list",
    icon: LeftToRightListBulletIcon,
    action: { kind: "linePrefix", prefix: "- ", placeholder: "list item" },
  },
  {
    id: "ol",
    label: "Numbered list",
    icon: LeftToRightListNumberIcon,
    action: { kind: "linePrefix", prefix: "1. ", placeholder: "list item" },
  },
  {
    id: "link",
    label: "Link",
    icon: Link02Icon,
    shortcut: "⌘K",
    action: { kind: "link" },
  },
];

/**
 * Typeform-flavored Markdown input.
 *
 * - Single-line look that matches the existing `input-typeform` styling, but
 *   auto-grows as the user adds content.
 * - Toolbar with one-click formatting (bold, italic, code, heading, quote,
 *   lists, link). Each button operates on the current selection or, if there
 *   is none, inserts a placeholder for the user to overwrite.
 * - Authors can flip into Preview mode to verify rendered Markdown.
 *   Clicking the rendered preview returns to edit mode.
 */
export function MarkdownField({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  autoFocus,
}: MarkdownFieldProps) {
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const trimmed = (value ?? "").trim();
  const showPreviewToggle = trimmed.length > 0;

  /**
   * Apply a toolbar action, mutating the textarea contents and selection.
   * After updating, we restore focus + a sensible new selection so the user
   * can keep typing.
   */
  const applyAction = React.useCallback(
    (action: ToolbarAction) => {
      const ta = textareaRef.current;
      const current = value ?? "";

      // Fall back to "append placeholder" if the textarea isn't mounted –
      // shouldn't happen during normal usage but keeps the function safe.
      const start = ta?.selectionStart ?? current.length;
      const end = ta?.selectionEnd ?? current.length;
      const selected = current.slice(start, end);

      let nextValue = current;
      let nextSelStart = start;
      let nextSelEnd = end;

      if (action.kind === "wrap") {
        const inner = selected || action.placeholder;
        nextValue =
          current.slice(0, start) +
          action.before +
          inner +
          action.after +
          current.slice(end);
        nextSelStart = start + action.before.length;
        nextSelEnd = nextSelStart + inner.length;
      } else if (action.kind === "linePrefix") {
        // Expand the selection to the start of the first selected line and
        // the end of the last selected line, then prefix every line.
        const lineStart =
          current.lastIndexOf("\n", Math.max(start - 1, 0)) + 1;
        const nlAfter = current.indexOf("\n", end);
        const lineEnd = nlAfter === -1 ? current.length : nlAfter;
        const block = current.slice(lineStart, lineEnd) || action.placeholder;
        const prefixed = block
          .split("\n")
          .map((ln) => `${action.prefix}${ln}`)
          .join("\n");
        nextValue =
          current.slice(0, lineStart) + prefixed + current.slice(lineEnd);
        // Place caret at the end of the (last) prefixed line so the user can
        // keep typing the heading/list item.
        nextSelStart = lineStart + prefixed.length;
        nextSelEnd = nextSelStart;
      } else if (action.kind === "link") {
        const text = selected || "link text";
        const snippet = `[${text}](https://)`;
        nextValue =
          current.slice(0, start) + snippet + current.slice(end);
        // Highlight the URL placeholder so the user can immediately paste/
        // overwrite it.
        const urlStart = start + 1 /* [ */ + text.length + 2 /* ]( */;
        nextSelStart = urlStart;
        nextSelEnd = urlStart + "https://".length;
      }

      onChange(nextValue);
      // Defer selection restoration until after React applies the new value.
      requestAnimationFrame(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.focus();
        try {
          t.setSelectionRange(nextSelStart, nextSelEnd);
        } catch {
          /* setSelectionRange can throw on non-text inputs – ignore */
        }
      });
    },
    [value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === "p") {
      if (trimmed) {
        e.preventDefault();
        setMode("preview");
      }
      return;
    }
    const map: Record<string, ToolbarAction | undefined> = {
      b: TOOLBAR.find((t) => t.id === "bold")?.action,
      i: TOOLBAR.find((t) => t.id === "italic")?.action,
      e: TOOLBAR.find((t) => t.id === "code")?.action,
      k: TOOLBAR.find((t) => t.id === "link")?.action,
    };
    const action = map[key];
    if (action) {
      e.preventDefault();
      applyAction(action);
    }
  };

  return (
    <div className="space-y-3">
      {mode === "edit" ? (
        <textarea
          ref={textareaRef}
          id={id}
          rows={1}
          autoFocus={autoFocus}
          placeholder={placeholder ?? "Type your answer here…"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className="input-typeform resize-none leading-snug field-sizing-content"
        />
      ) : (
        <button
          type="button"
          onClick={() => setMode("edit")}
          aria-label="Switch back to edit mode"
          className="block w-full cursor-text border-b-2 border-coral/70 py-3 text-left transition-colors hover:border-coral"
        >
          <Markdown source={value ?? ""} size="answer" />
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="toolbar"
          aria-label="Markdown formatting"
          aria-disabled={mode === "preview"}
          className={cn(
            "inline-flex flex-wrap items-center gap-1 rounded-full border border-ink/12 bg-cream/80 p-1 shadow-soft",
            mode === "preview" && "pointer-events-none opacity-50",
          )}
        >
          {TOOLBAR.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx === 3 && <ToolbarDivider />}
              {idx === 7 && <ToolbarDivider />}
              <ToolbarButton
                item={item}
                onClick={() => applyAction(item.action)}
              />
            </React.Fragment>
          ))}
        </div>

        {showPreviewToggle && (
          <div
            role="tablist"
            aria-label="Markdown editor mode"
            className="inline-flex items-center gap-0.5 rounded-full border border-ink/15 bg-cream p-0.5"
          >
            <ModeButton
              active={mode === "edit"}
              onClick={() => setMode("edit")}
              icon={PencilEdit02Icon}
              label="Edit"
            />
            <ModeButton
              active={mode === "preview"}
              onClick={() => setMode("preview")}
              icon={ViewIcon}
              label="Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-ink/12" />;
}

function ToolbarButton({
  item,
  onClick,
}: {
  item: ToolbarItem;
  onClick: () => void;
}) {
  const title = item.shortcut ? `${item.label}  (${item.shortcut})` : item.label;
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Prevent the textarea from losing focus + selection.
        e.preventDefault();
      }}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-ink/65 transition-colors",
        "hover:bg-coral/12 hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/55",
      )}
    >
      <Icon icon={item.icon} size={16} strokeWidth={2} />
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: Parameters<typeof Icon>[0]["icon"];
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors",
        active
          ? "bg-coral text-coral-foreground shadow-sm"
          : "text-ink/55 hover:text-ink",
      )}
    >
      <Icon icon={icon} size={12} strokeWidth={2} />
      {label}
    </button>
  );
}
