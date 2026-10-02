// SQLite compiled to WebAssembly (sql.js), stored in the phone's IndexedDB (D-043).
import type { Database, SqlValue } from "sql.js";

export type Row = Record<string, any>;
export type Param = string | number | boolean | null | undefined | Uint8Array;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE account (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'pl', timezone TEXT NOT NULL DEFAULT 'Europe/Warsaw', created_at TEXT NOT NULL);
  CREATE TABLE device_session (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, device_name TEXT, token_hash TEXT UNIQUE NOT NULL,
    remember INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_seen_at TEXT, revoked_at TEXT);
  CREATE TABLE push_subscription (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, endpoint TEXT UNIQUE NOT NULL, p256dh TEXT NOT NULL,
    auth TEXT NOT NULL, platform TEXT, created_at TEXT NOT NULL, last_success_at TEXT, failure_count INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE athlete (id INTEGER PRIMARY KEY, account_id INTEGER UNIQUE NOT NULL, display_name TEXT, height_cm REAL,
    outdoor_power_meter INTEGER NOT NULL DEFAULT 0, learning_until TEXT, onboarded INTEGER NOT NULL DEFAULT 0,
    ladder_json TEXT NOT NULL DEFAULT '{}', gut_level INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  CREATE TABLE fitness_snapshot (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, effective_from TEXT NOT NULL, ftp_w REAL NOT NULL,
    lthr_bpm REAL, max_hr_bpm REAL, weight_kg REAL, source TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL);
  CREATE TABLE equipment (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, kind TEXT NOT NULL, model TEXT, role TEXT, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE goal (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, role TEXT NOT NULL, type TEXT NOT NULL, target_json TEXT,
    event_name TEXT, event_date TEXT, priority TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, archived_at TEXT);
  CREATE TABLE availability (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, effective_from TEXT NOT NULL,
    long_ride_days_allowed INTEGER NOT NULL DEFAULT 1, long_ride_every_weeks INTEGER NOT NULL DEFAULT 5, created_at TEXT NOT NULL);
  CREATE TABLE availability_day (availability_id INTEGER NOT NULL, weekday INTEGER NOT NULL, available INTEGER NOT NULL,
    max_minutes INTEGER NOT NULL, default_ride_mode TEXT NOT NULL, notify_time TEXT NOT NULL, PRIMARY KEY (availability_id, weekday));
  CREATE TABLE training_plan (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL,
    starts_on TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE plan_week (id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL, week_start TEXT NOT NULL, kind TEXT NOT NULL,
    block_index INTEGER NOT NULL, focus TEXT NOT NULL, target_load REAL NOT NULL, UNIQUE (plan_id, week_start));
  CREATE TABLE planned_workout (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, plan_id INTEGER, date TEXT NOT NULL,
    workout_slug TEXT NOT NULL, role TEXT NOT NULL, is_key INTEGER NOT NULL, origin TEXT NOT NULL, workout_json TEXT NOT NULL,
    ride_mode TEXT NOT NULL, ride_mode_source TEXT NOT NULL DEFAULT 'default', status TEXT NOT NULL DEFAULT 'planned',
    icu_event_id TEXT, delivery_status TEXT NOT NULL DEFAULT 'pending', delivered_at TEXT, version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE INDEX planned_by_date ON planned_workout (athlete_id, date);
  CREATE TABLE source_connection (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, provider TEXT NOT NULL, external_athlete_id TEXT,
    api_key_encrypted TEXT, status TEXT NOT NULL DEFAULT 'ok', last_sync_at TEXT, last_error TEXT, UNIQUE (athlete_id, provider));
  CREATE TABLE activity (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, icu_id TEXT UNIQUE NOT NULL, source_device TEXT NOT NULL,
    type TEXT NOT NULL, name TEXT, date TEXT NOT NULL, start_at TEXT NOT NULL, moving_seconds INTEGER NOT NULL, distance_m REAL,
    elevation_m REAL, avg_power REAL, weighted_power REAL, avg_hr REAL, max_hr REAL, load REAL, load_basis TEXT,
    is_master INTEGER NOT NULL DEFAULT 1, duplicate_of TEXT, planned_workout_id INTEGER, compliance_pct REAL, rpe INTEGER, feel TEXT,
    fit_path TEXT, best_1min REAL, best_20min REAL, raw_json TEXT, created_at TEXT NOT NULL);
  CREATE INDEX activity_by_date ON activity (athlete_id, date);
  CREATE TABLE wellness_day (athlete_id INTEGER NOT NULL, date TEXT NOT NULL, hrv REAL, resting_hr REAL, sleep_seconds REAL,
    sleep_score REAL, body_battery_max REAL, body_battery_min REAL, garmin_readiness REAL, stress_avg REAL, weight_kg REAL,
    raw_json TEXT, fetched_at TEXT NOT NULL, PRIMARY KEY (athlete_id, date));
  CREATE TABLE check_in (athlete_id INTEGER NOT NULL, date TEXT NOT NULL, sleep_quality INTEGER NOT NULL, legs INTEGER NOT NULL,
    motivation INTEGER NOT NULL, sick INTEGER NOT NULL, pain INTEGER NOT NULL, pain_note TEXT, ride_mode TEXT NOT NULL,
    bonus_minutes INTEGER, submitted_at TEXT NOT NULL, PRIMARY KEY (athlete_id, date));
  CREATE TABLE daily_state (athlete_id INTEGER NOT NULL, date TEXT NOT NULL, load REAL NOT NULL DEFAULT 0, fitness REAL NOT NULL DEFAULT 0,
    fatigue REAL NOT NULL DEFAULT 0, form REAL NOT NULL DEFAULT 0, form_pct REAL, readiness_score REAL, readiness_state TEXT,
    readiness_json TEXT, computed_at TEXT NOT NULL, PRIMARY KEY (athlete_id, date));
  CREATE TABLE adaptation (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, date TEXT NOT NULL, planned_workout_id INTEGER,
    related_planned_id INTEGER, origin TEXT NOT NULL, action TEXT NOT NULL, before_json TEXT, after_json TEXT,
    reason_codes_json TEXT NOT NULL DEFAULT '[]', text TEXT, applied_at TEXT NOT NULL, undone_at TEXT);
  CREATE TABLE ai_proposal (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, adaptation_id INTEGER, context TEXT NOT NULL,
    raw_json TEXT NOT NULL, verdict TEXT NOT NULL, rejection_reasons_json TEXT, model TEXT, created_at TEXT NOT NULL);
  CREATE TABLE daily_brief (athlete_id INTEGER NOT NULL, date TEXT NOT NULL, facts_json TEXT NOT NULL, text_pl TEXT NOT NULL,
    lines_json TEXT NOT NULL, slots_source_json TEXT, model TEXT, prompt_version INTEGER, validator_passed INTEGER,
    with_check_in INTEGER NOT NULL, generated_at TEXT NOT NULL, opened_at TEXT, PRIMARY KEY (athlete_id, date));
  CREATE TABLE notification_log (athlete_id INTEGER NOT NULL, date TEXT NOT NULL, sent_at TEXT NOT NULL, devices INTEGER NOT NULL,
    PRIMARY KEY (athlete_id, date));
  CREATE TABLE chat_message (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
    meta_json TEXT, created_at TEXT NOT NULL);
  CREATE TABLE chat_note (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL,
    start_date TEXT NOT NULL, end_date TEXT NOT NULL, source_message_id INTEGER, created_at TEXT NOT NULL, deleted_at TEXT);
  CREATE TABLE ftp_suggestion (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, current_ftp REAL NOT NULL, suggested_ftp REAL NOT NULL,
    basis TEXT NOT NULL, evidence_json TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, decided_at TEXT);
  CREATE TABLE long_ride_proposal (id INTEGER PRIMARY KEY, athlete_id INTEGER NOT NULL, proposed_date TEXT NOT NULL, minutes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL, decided_at TEXT);
  CREATE TABLE knowledge_chunk (id INTEGER PRIMARY KEY, source TEXT NOT NULL, doc_path TEXT NOT NULL, heading TEXT NOT NULL,
    text TEXT NOT NULL, embedding_json TEXT, content_hash TEXT UNIQUE NOT NULL);
  CREATE TABLE job_run (id INTEGER PRIMARY KEY, job TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL,
    error_code TEXT, details_json TEXT);
  CREATE TABLE setting (account_id INTEGER NOT NULL, key TEXT NOT NULL, value_json TEXT NOT NULL, PRIMARY KEY (account_id, key));
  `,
  // v2 — phone-only, one-tap check-in (D-043, D-044)
  `
  ALTER TABLE check_in ADD COLUMN exhausted INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE check_in ADD COLUMN feeling TEXT;
  `,
];

export class Db {
  private depth = 0;
  constructor(readonly raw: Database, private readonly onWrite: () => void = () => undefined) {
    this.migrate();
  }

  private migrate(): void {
    this.raw.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
    const cur = this.get<{ v: number | null }>("SELECT MAX(version) AS v FROM schema_version")?.v ?? 0;
    for (let v = cur; v < MIGRATIONS.length; v++) {
      this.tx(() => {
        this.raw.exec(MIGRATIONS[v]!);
        this.run("INSERT INTO schema_version (version) VALUES (?)", v + 1);
      });
    }
  }

  private bind(params: Param[]): SqlValue[] {
    return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
  }

  all<T = Row>(sql: string, ...params: Param[]): T[] {
    const stmt = this.raw.prepare(sql);
    try {
      stmt.bind(this.bind(params));
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      return out;
    } finally {
      stmt.free();
    }
  }
  get<T = Row>(sql: string, ...params: Param[]): T | undefined {
    return this.all<T>(sql, ...params)[0];
  }
  run(sql: string, ...params: Param[]): { changes: number; id: number } {
    this.raw.run(sql, this.bind(params));
    const changes = this.raw.getRowsModified();
    const id = Number(this.raw.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] ?? 0);
    if (this.depth === 0) this.onWrite();
    return { changes, id };
  }
  tx<T>(fn: () => T): T {
    if (this.depth > 0) {
      this.depth++;
      try {
        return fn();
      } finally {
        this.depth--;
      }
    }
    this.raw.exec("BEGIN");
    this.depth = 1;
    try {
      const out = fn();
      this.raw.exec("COMMIT");
      return out;
    } catch (e) {
      this.raw.exec("ROLLBACK");
      throw e;
    } finally {
      this.depth = 0;
      this.onWrite();
    }
  }
  meta(key: string): string | undefined {
    return this.get<{ value: string }>("SELECT value FROM meta WHERE key = ?", key)?.value;
  }
  setMeta(key: string, value: string): void {
    this.run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
  }
  export(): Uint8Array {
    return this.raw.export();
  }
  close(): void {
    this.raw.close();
  }
}

export const nowIso = () => new Date().toISOString();
