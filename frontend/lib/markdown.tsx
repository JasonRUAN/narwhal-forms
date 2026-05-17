import * as React from "react";

/**
 * Lightweight Markdown renderer for the typeform-style runner.
 *
 * Supports a sensible subset (headings, bold/italic, inline & fenced code,
 * links, ordered/unordered lists, blockquotes, horizontal rule, hard line
 * breaks). Implemented without external dependencies; user input is mapped to
 * React elements only — never via dangerouslySetInnerHTML — so raw HTML can
 * not be injected.
 */

interface InlineContext {
  keyPrefix: string;
}

function isSafeUrl(url: string): boolean {
  if (/^(https?:|mailto:)/i.test(url)) return true;
  if (/^[/#]/.test(url)) return true;
  return false;
}

function renderInline(text: string, ctx: InlineContext): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let i = 0;
  let keyCounter = 0;
  const flush = (s: string) => {
    if (s) nodes.push(s);
  };
  const peek = (n: number) => text.slice(i, i + n);

  while (i < text.length) {
    const ch = text[i];

    // Inline code – `…`
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flush(text.slice(cursor, i));
        nodes.push(
          <code
            key={`${ctx.keyPrefix}-c-${keyCounter++}`}
            className="rounded bg-ink/8 px-1 py-px font-mono-display text-[0.92em]"
          >
            {text.slice(i + 1, end)}
          </code>,
        );
        i = end + 1;
        cursor = i;
        continue;
      }
    }

    // Bold – ** … ** or __ … __
    if (peek(2) === "**" || peek(2) === "__") {
      const marker = peek(2);
      const end = text.indexOf(marker, i + 2);
      if (end !== -1) {
        flush(text.slice(cursor, i));
        nodes.push(
          <strong
            key={`${ctx.keyPrefix}-b-${keyCounter++}`}
            className="font-semibold text-ink"
          >
            {renderInline(text.slice(i + 2, end), {
              keyPrefix: `${ctx.keyPrefix}-b${keyCounter}`,
            })}
          </strong>,
        );
        i = end + 2;
        cursor = i;
        continue;
      }
    }

    // Italic – * … * or _ … _
    if (
      (ch === "*" || ch === "_") &&
      text[i + 1] !== ch &&
      text[i + 1] !== " " &&
      text[i + 1] !== undefined
    ) {
      let j = i + 1;
      let foundEnd = -1;
      while (j < text.length) {
        if (text[j] === ch && text[j - 1] !== " " && text[j + 1] !== ch) {
          foundEnd = j;
          break;
        }
        j++;
      }
      if (foundEnd !== -1) {
        flush(text.slice(cursor, i));
        nodes.push(
          <em
            key={`${ctx.keyPrefix}-i-${keyCounter++}`}
            className="italic"
          >
            {renderInline(text.slice(i + 1, foundEnd), {
              keyPrefix: `${ctx.keyPrefix}-i${keyCounter}`,
            })}
          </em>,
        );
        i = foundEnd + 1;
        cursor = i;
        continue;
      }
    }

    // Links – [text](url)
    if (ch === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          const linkText = text.slice(i + 1, closeBracket);
          const rawUrl = text.slice(closeBracket + 2, closeParen).trim();
          if (isSafeUrl(rawUrl)) {
            flush(text.slice(cursor, i));
            nodes.push(
              <a
                key={`${ctx.keyPrefix}-l-${keyCounter++}`}
                href={rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-coral underline decoration-dotted underline-offset-2 hover:opacity-90"
              >
                {renderInline(linkText, {
                  keyPrefix: `${ctx.keyPrefix}-l${keyCounter}`,
                })}
              </a>,
            );
            i = closeParen + 1;
            cursor = i;
            continue;
          }
        }
      }
    }

    i++;
  }
  flush(text.slice(cursor));
  return nodes;
}

interface BlockToken {
  type: "heading" | "paragraph" | "code" | "ul" | "ol" | "quote" | "hr";
  content?: string;
  level?: number;
  lang?: string;
  items?: string[];
}

function tokenize(src: string): BlockToken[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const tokens: BlockToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || "";
      const collected: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        collected.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      tokens.push({ type: "code", content: collected.join("\n"), lang });
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      tokens.push({ type: "hr" });
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      tokens.push({
        type: "heading",
        level: heading[1].length,
        content: heading[2].trim(),
      });
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const collected: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        collected.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      tokens.push({ type: "quote", content: collected.join("\n") });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      tokens.push({ type: "ul", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      tokens.push({ type: "ol", items });
      continue;
    }

    const para: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (
        /^\s*$/.test(next) ||
        /^\s*```/.test(next) ||
        /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(next) ||
        /^#{1,6}\s+/.test(next) ||
        /^\s*>\s?/.test(next) ||
        /^\s*[-*+]\s+/.test(next) ||
        /^\s*\d+\.\s+/.test(next)
      ) {
        break;
      }
      para.push(next);
      i++;
    }
    tokens.push({ type: "paragraph", content: para.join("\n") });
  }

  return tokens;
}

function renderParagraph(text: string, key: string): React.ReactNode {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((ln, idx) => {
    out.push(
      <React.Fragment key={`${key}-ln-${idx}`}>
        {renderInline(ln, { keyPrefix: `${key}-ln${idx}` })}
      </React.Fragment>,
    );
    if (idx < lines.length - 1) out.push(<br key={`${key}-br-${idx}`} />);
  });
  return out;
}

interface MarkdownProps {
  source: string;
  className?: string;
  /**
   * Visual scale.
   *  - "answer"  – matches the typeform answer scale (≈ 1.5rem on md+).
   *  - "compact" – inline-list / admin row scale.
   */
  size?: "answer" | "compact";
}

const ROOT_BY_SIZE = {
  answer:
    "space-y-3 text-2xl md:text-3xl font-medium leading-snug text-ink",
  compact: "space-y-2 text-sm leading-relaxed text-ink",
} as const;

const HEADING_CLASSES_BY_SIZE: Record<
  "answer" | "compact",
  Record<number, string>
> = {
  answer: {
    1: "mt-1 mb-2 text-4xl md:text-5xl font-display font-semibold tracking-tight",
    2: "mt-1 mb-2 text-3xl md:text-4xl font-display font-semibold tracking-tight",
    3: "mt-1 mb-1.5 text-2xl md:text-3xl font-display font-semibold",
    4: "mt-1 mb-1 text-xl md:text-2xl font-display font-semibold",
    5: "mt-1 mb-1 text-lg font-semibold uppercase tracking-wider",
    6: "mt-1 mb-1 text-base font-semibold uppercase tracking-wider text-ink/65",
  },
  compact: {
    1: "mt-1 mb-1.5 text-lg font-semibold tracking-tight",
    2: "mt-1 mb-1.5 text-base font-semibold tracking-tight",
    3: "mt-1 mb-1 text-sm font-semibold",
    4: "mt-1 mb-1 text-sm font-semibold",
    5: "mt-0.5 mb-0.5 text-xs font-semibold uppercase tracking-wider",
    6: "mt-0.5 mb-0.5 text-xs font-semibold uppercase tracking-wider text-ink/55",
  },
};

export function Markdown({
  source,
  className,
  size = "compact",
}: MarkdownProps) {
  const tokens = React.useMemo(() => tokenize(source ?? ""), [source]);
  const headingClasses = HEADING_CLASSES_BY_SIZE[size];
  return (
    <div className={`${ROOT_BY_SIZE[size]}${className ? ` ${className}` : ""}`}>
      {tokens.map((tk, idx) => {
        const key = `tk-${idx}`;
        switch (tk.type) {
          case "heading": {
            const lvl = Math.min(Math.max(tk.level ?? 1, 1), 6);
            const cls = headingClasses[lvl];
            const inline = renderInline(tk.content ?? "", { keyPrefix: key });
            if (lvl === 1) return <h1 key={key} className={cls}>{inline}</h1>;
            if (lvl === 2) return <h2 key={key} className={cls}>{inline}</h2>;
            if (lvl === 3) return <h3 key={key} className={cls}>{inline}</h3>;
            if (lvl === 4) return <h4 key={key} className={cls}>{inline}</h4>;
            if (lvl === 5) return <h5 key={key} className={cls}>{inline}</h5>;
            return <h6 key={key} className={cls}>{inline}</h6>;
          }
          case "paragraph":
            return (
              <p key={key} className="whitespace-normal">
                {renderParagraph(tk.content ?? "", key)}
              </p>
            );
          case "code":
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-xl border border-ink/12 bg-ink/4 p-3 font-mono-display text-[0.78em] leading-relaxed"
                data-lang={tk.lang || undefined}
              >
                <code>{tk.content ?? ""}</code>
              </pre>
            );
          case "ul":
            return (
              <ul
                key={key}
                className="ml-5 list-disc space-y-1 marker:text-coral"
              >
                {(tk.items ?? []).map((it, j) => (
                  <li key={`${key}-li-${j}`}>
                    {renderInline(it, { keyPrefix: `${key}-li${j}` })}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={key}
                className="ml-5 list-decimal space-y-1 marker:text-coral"
              >
                {(tk.items ?? []).map((it, j) => (
                  <li key={`${key}-li-${j}`}>
                    {renderInline(it, { keyPrefix: `${key}-li${j}` })}
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-4 border-coral/60 pl-4 text-ink/70 italic"
              >
                {renderParagraph(tk.content ?? "", key)}
              </blockquote>
            );
          case "hr":
            return (
              <hr
                key={key}
                className="my-2 border-0 border-t border-ink/15"
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
