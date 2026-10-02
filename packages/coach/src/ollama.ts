// Minimal client for a local Ollama server (D-017, D-030). Everything stays on the PC.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmClient {
  /** JSON-mode completion constrained by a JSON schema. */
  json<T>(messages: ChatMessage[], schema: object, opts?: { temperature?: number }): Promise<T>;
  embed(texts: string[]): Promise<number[][]>;
  health(): Promise<{ ok: boolean; model?: string; error?: string }>;
}

export interface OllamaOptions {
  baseUrl?: string;
  model: string;
  fallbackModel?: string;
  embedModel?: string;
  /** Context window; Ollama's default is small and silently truncates (S06). */
  numCtx?: number;
  timeoutMs?: number;
  keepAlive?: string;
}

export class OllamaClient implements LlmClient {
  private readonly base: string;
  constructor(private readonly opts: OllamaOptions) {
    this.base = (opts.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  }

  private async post(path: string, body: unknown): Promise<any> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 120_000);
    try {
      const res = await fetch(this.base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Ollama ${path} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async json<T>(messages: ChatMessage[], schema: object, opts: { temperature?: number } = {}): Promise<T> {
    const run = async (model: string) => {
      const out = await this.post("/api/chat", {
        model,
        messages,
        stream: false,
        format: schema,
        keep_alive: this.opts.keepAlive ?? "10m",
        options: { num_ctx: this.opts.numCtx ?? 8192, temperature: opts.temperature ?? 0.4 },
      });
      const content: string = out?.message?.content ?? "";
      return JSON.parse(stripThinking(content)) as T;
    };
    try {
      return await run(this.opts.model);
    } catch (e) {
      if (!this.opts.fallbackModel) throw e;
      return await run(this.opts.fallbackModel);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out = await this.post("/api/embed", { model: this.opts.embedModel ?? "bge-m3", input: texts });
    return out.embeddings as number[][];
  }

  async health(): Promise<{ ok: boolean; model?: string; error?: string }> {
    try {
      const res = await fetch(this.base + "/api/tags", { signal: AbortSignal.timeout(3000) });
      const data: any = await res.json();
      const names: string[] = (data.models ?? []).map((m: any) => m.name);
      const has = names.some((n) => n === this.opts.model || n.startsWith(this.opts.model + ":"));
      return has ? { ok: true, model: this.opts.model } : { ok: false, error: `model ${this.opts.model} not pulled` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

/** Some reasoning models prefix <think>…</think>; JSON follows it. */
export function stripThinking(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
