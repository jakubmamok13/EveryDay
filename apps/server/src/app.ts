import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { localDateTime, type ISODate } from "@everyday/shared";
import { OllamaClient, type LlmClient } from "@everyday/coach";
import { Db } from "./db";
import { FakeIcuClient } from "./fake-icu";
import { RealIcuClient, type IcuClient } from "./icu";
import { SecretBox } from "./secrets";

export interface Config {
  dataDir: string;
  port: number;
  host: string;
  demo: boolean;
  timeZone: string;
  repoRoot: string;
  webDist: string;
}

export interface CoachSettings {
  aiEnabled: boolean;
  model: string;
  fallbackModel: string;
  embedModel: string;
  ollamaUrl: string;
  numCtx: number;
}

export const DEFAULT_COACH: CoachSettings = {
  aiEnabled: true,
  model: "qwen3.8-uncensored",
  fallbackModel: "qwen3.8",
  embedModel: "bge-m3",
  ollamaUrl: "http://127.0.0.1:11434",
  numCtx: 8192,
};

export class App {
  readonly db: Db;
  readonly secrets: SecretBox;
  private icuClient: IcuClient | null = null;
  private llmCache: { client: LlmClient | null; at: number; key: string } | null = null;
  /** For tests and demo: override "now". */
  clock: () => Date = () => new Date();

  constructor(readonly config: Config) {
    for (const d of ["", "fit", "backups", "logs"]) {
      const p = join(config.dataDir, d);
      if (!existsSync(p)) mkdirSync(p, { recursive: true });
    }
    this.db = new Db(join(config.dataDir, config.demo ? "everyday-demo.db" : "everyday.db"));
    this.secrets = new SecretBox(join(config.dataDir, "secret.key"));
  }

  now(): { date: ISODate; time: string; minutes: number } {
    return localDateTime(this.clock(), this.config.timeZone);
  }
  today(): ISODate {
    return this.now().date;
  }

  // ---------- single account / athlete ----------

  accountId(): number | null {
    return this.db.get<{ id: number }>("SELECT id FROM account ORDER BY id LIMIT 1")?.id ?? null;
  }
  athleteId(): number | null {
    return this.db.get<{ id: number }>("SELECT id FROM athlete ORDER BY id LIMIT 1")?.id ?? null;
  }
  requireAthlete(): number {
    const id = this.athleteId();
    if (!id) throw Object.assign(new Error("no athlete"), { statusCode: 409 });
    return id;
  }

  // ---------- settings ----------

  setting<T>(key: string, fallback: T): T {
    const acc = this.accountId() ?? 0;
    const row = this.db.get<{ value_json: string }>("SELECT value_json FROM setting WHERE account_id = ? AND key = ?", acc, key);
    return row ? { ...((fallback as object) ?? {}), ...JSON.parse(row.value_json) } as T : fallback;
  }
  setSetting(key: string, value: unknown): void {
    const acc = this.accountId() ?? 0;
    this.db.run(
      "INSERT INTO setting (account_id, key, value_json) VALUES (?, ?, ?) ON CONFLICT(account_id, key) DO UPDATE SET value_json = excluded.value_json",
      acc, key, JSON.stringify(value),
    );
    if (key === "coach") this.llmCache = null;
  }

  // ---------- intervals.icu ----------

  icu(): IcuClient | null {
    if (this.config.demo) {
      this.icuClient ??= new FakeIcuClient(() => this.today());
      return this.icuClient;
    }
    const athlete = this.athleteId();
    if (!athlete) return null;
    const row = this.db.get<{ api_key_encrypted: string | null; external_athlete_id: string | null }>(
      "SELECT api_key_encrypted, external_athlete_id FROM source_connection WHERE athlete_id = ? AND provider = 'intervals_icu'",
      athlete,
    );
    if (!row?.api_key_encrypted) return null;
    if (!this.icuClient) this.icuClient = new RealIcuClient(this.secrets.open(row.api_key_encrypted), row.external_athlete_id || "0");
    return this.icuClient;
  }
  resetIcu(): void {
    this.icuClient = null;
  }

  // ---------- Coach AI (Ollama on this PC) ----------

  coachSettings(): CoachSettings {
    return this.setting("coach", DEFAULT_COACH);
  }

  /** The local model if enabled and reachable; null means template / rule mode. */
  async llm(): Promise<LlmClient | null> {
    const s = this.coachSettings();
    if (!s.aiEnabled) return null;
    const key = JSON.stringify(s);
    if (this.llmCache && this.llmCache.key === key && Date.now() - this.llmCache.at < 5 * 60_000) return this.llmCache.client;
    const client = new OllamaClient({
      baseUrl: s.ollamaUrl,
      model: s.model,
      fallbackModel: s.fallbackModel,
      embedModel: s.embedModel,
      numCtx: s.numCtx,
      timeoutMs: 120_000,
    });
    const h = await client.health();
    if (!h.ok) {
      // Try the fallback model name before giving up.
      const fb = new OllamaClient({ baseUrl: s.ollamaUrl, model: s.fallbackModel, embedModel: s.embedModel, numCtx: s.numCtx });
      const hf = await fb.health();
      this.llmCache = { client: hf.ok ? fb : null, at: Date.now(), key };
      return this.llmCache.client;
    }
    this.llmCache = { client, at: Date.now(), key };
    return client;
  }
}
