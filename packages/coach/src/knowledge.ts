// Knowledge Base (M11): Method Notes chunked by heading, searched by
// embeddings (cosine in JS, D-039) or by keywords when no embedding model is available.

export interface KnowledgeChunk {
  source: "method_notes" | "book";
  docPath: string;
  heading: string;
  text: string;
  embedding?: number[] | null;
}

export function chunkMarkdown(docPath: string, markdown: string, source: KnowledgeChunk["source"] = "method_notes"): KnowledgeChunk[] {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? docPath;
  const parts = markdown.split(/^##\s+/m);
  const chunks: KnowledgeChunk[] = [];
  const intro = parts[0]!.replace(/^#\s+.+$/m, "").trim();
  if (intro) chunks.push({ source, docPath, heading: title, text: intro });
  for (const part of parts.slice(1)) {
    const [head, ...body] = part.split("\n");
    const text = body.join("\n").trim();
    if (text) chunks.push({ source, docPath, heading: `${title} — ${head!.trim()}`, text });
  }
  return chunks;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function topByEmbedding(query: number[], chunks: KnowledgeChunk[], k: number): KnowledgeChunk[] {
  return chunks
    .filter((c) => c.embedding && c.embedding.length === query.length)
    .map((c) => ({ c, s: cosine(query, c.embedding!) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.c);
}

const STOP = new Set(["i", "w", "na", "z", "do", "to", "się", "jak", "co", "czy", "nie", "jest", "o", "po", "a", "że", "dla", "mi", "mam", "dziś"]);

function tokens(t: string): string[] {
  return t.toLowerCase().split(/[^a-ząćęłńóśźż0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
}

/** Keyword fallback: TF-IDF-like overlap with crude Polish stemming (first 5 letters). */
export function topByKeywords(query: string, chunks: KnowledgeChunk[], k: number): KnowledgeChunk[] {
  const stem = (w: string) => w.slice(0, 5);
  const docs = chunks.map((c) => ({ c, body: tokens(c.text).map(stem), head: tokens(c.heading).map(stem) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set([...d.body, ...d.head])) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log((docs.length + 1) / ((df.get(t) ?? 0) + 1)) + 0.1;
  const q = new Set(tokens(query).map(stem));
  return docs
    .map(({ c, body, head }) => {
      let s = 0;
      for (const t of q) {
        const inBody = body.filter((x) => x === t).length;
        const inHead = head.includes(t) ? 2 : 0;
        if (inBody || inHead) s += idf(t) * (Math.min(inBody, 3) + inHead);
      }
      return { c, s: s / Math.sqrt(body.length + 10) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.c);
}

export function formatPassages(chunks: KnowledgeChunk[]): string {
  return chunks.map((c, i) => `[${i + 1}] ${c.heading}\n${c.text}`).join("\n\n");
}
