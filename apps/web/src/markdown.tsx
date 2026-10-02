import type { ReactNode } from "react";

// Tiny Markdown renderer for the bundled Method Notes (headings, lists,
// paragraphs, **bold**). Builds React elements: no HTML injection.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const li = /^\s*(?:[-*]|(\d+)\.)\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      out.push(h[1]!.length === 1 ? <h1 key={out.length}>{inline(h[2]!)}</h1> : <h2 key={out.length}>{inline(h[2]!)}</h2>);
    } else if (li) {
      flushPara();
      const ordered = !!li[1];
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(li[2]!);
    } else if (!line.trim() || /^\|?\s*-{3,}/.test(line)) {
      flushPara();
      flushList();
    } else if (list && /^\s+\S/.test(line)) {
      // indented continuation of the last list item
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="md">{out}</div>;
}

export const noteTitle = (text: string, fallback: string) => /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? fallback;
