import type { App } from "../app";

// Export / import / wipe (R8-03). Everything lives on this phone (D-043), so the
// export file is the only backup: one JSON object, one key per table.

const TABLES = [
  "account", "athlete", "fitness_snapshot", "equipment", "goal", "availability", "availability_day", "training_plan", "plan_week",
  "planned_workout", "activity", "wellness_day", "check_in", "daily_state", "adaptation", "daily_brief",
  "chat_note", "ftp_suggestion", "long_ride_proposal", "setting", "source_connection", "week_override", "season_event",
];
/** Never exported: the intervals.icu key stays on this phone. */
const SECRET_COLUMNS: Record<string, string[]> = { source_connection: ["api_key_encrypted"] };

export interface ExportFile {
  app: "everyday";
  version: 1;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

export function exportJson(app: App): ExportFile {
  const tables: ExportFile["tables"] = {};
  for (const t of TABLES) {
    tables[t] = app.db.all<Record<string, unknown>>(`SELECT * FROM ${t}`).map((row) => {
      for (const c of SECRET_COLUMNS[t] ?? []) row[c] = null;
      return row;
    });
  }
  return { app: "everyday", version: 1, exportedAt: new Date().toISOString(), tables };
}

/** Replace all data with an export file (from this or another phone). */
export function importJson(app: App, file: ExportFile): void {
  if (file?.app !== "everyday" || typeof file.tables !== "object") throw Object.assign(new Error("To nie jest plik eksportu EveryDay."), { statusCode: 400 });
  const key = app.db.get<{ api_key_encrypted: string | null }>("SELECT api_key_encrypted FROM source_connection WHERE provider = 'intervals_icu'")?.api_key_encrypted ?? null;
  app.db.tx(() => {
    wipeTables(app);
    for (const t of TABLES) {
      const columns = new Set(app.db.all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name));
      for (const row of file.tables[t] ?? []) {
        const cols = Object.keys(row).filter((c) => columns.has(c));
        if (!cols.length) continue;
        app.db.run(`INSERT INTO ${t} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...cols.map((c) => row[c] as never));
      }
    }
    if (key) app.db.run("UPDATE source_connection SET api_key_encrypted = ? WHERE provider = 'intervals_icu' AND api_key_encrypted IS NULL", key);
  });
  app.resetIcu();
}

function wipeTables(app: App): void {
  for (const t of [...TABLES].reverse()) app.db.run(`DELETE FROM ${t}`);
  app.db.run("DELETE FROM job_run");
}

/** "Usuń wszystkie dane": nothing is left on this phone. */
export function wipe(app: App): void {
  app.db.tx(() => wipeTables(app));
  for (const k of ["last_night_job", "last_day_sync"]) app.db.setMeta(k, "");
  app.resetIcu();
}
