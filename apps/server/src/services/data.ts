import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { crc32 } from "node:zlib";
import type { App } from "../app";

// Backups (03 §8), export ZIP and account deletion (R8-03).

export function backup(app: App): string {
  const dir = join(app.config.dataDir, "backups");
  mkdirSync(dir, { recursive: true });
  const date = app.today();
  const file = join(dir, `everyday-${date}.db`);
  if (existsSync(file)) unlinkSync(file);
  app.db.raw.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const extra = app.setting<{ dir?: string }>("backup", {}).dir;
  if (extra && existsSync(extra)) {
    const copy = join(extra, basename(file));
    if (existsSync(copy)) unlinkSync(copy);
    app.db.raw.exec(`VACUUM INTO '${copy.replace(/'/g, "''")}'`);
  }
  rotate(dir);
  return file;
}

/** Keep 14 daily copies + one per week for 8 weeks. */
function rotate(dir: string): void {
  const files = readdirSync(dir).filter((f) => /^everyday-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse();
  const keep = new Set(files.slice(0, 14));
  const weeks = new Set<string>();
  for (const f of files) {
    const d = new Date(f.slice(9, 19) + "T00:00:00Z");
    const wk = `${d.getUTCFullYear()}-${Math.floor((d.getTime() / 86_400_000 + 3) / 7)}`;
    if (!weeks.has(wk) && weeks.size < 8) {
      weeks.add(wk);
      keep.add(f);
    }
  }
  for (const f of files) if (!keep.has(f)) unlinkSync(join(dir, f));
}

/** Minimal ZIP writer (stored entries) — no extra dependency. */
function zip(entries: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, e.data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(e.data.length, 20);
    c.writeUInt32LE(e.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + e.data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const EXPORT_TABLES = [
  "athlete", "fitness_snapshot", "equipment", "goal", "availability", "availability_day", "training_plan", "plan_week",
  "planned_workout", "activity", "wellness_day", "check_in", "daily_state", "adaptation", "ai_proposal", "daily_brief",
  "chat_message", "chat_note", "ftp_suggestion", "long_ride_proposal",
];

export function exportZip(app: App): Buffer {
  const entries = EXPORT_TABLES.map((t) => ({ name: `${t}.json`, data: Buffer.from(JSON.stringify(app.db.all(`SELECT * FROM ${t}`), null, 1)) }));
  const fitDir = join(app.config.dataDir, "fit");
  const walk = (d: string): string[] =>
    existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : [];
  for (const f of walk(fitDir)) entries.push({ name: `fit/${basename(f)}`, data: readFileSync(f) });
  entries.push({ name: "README.txt", data: Buffer.from("Eksport EveryDay: jedna tabela = jeden plik JSON, pliki FIT w folderze fit/.\n") });
  return zip(entries);
}

export function deleteAccount(app: App): void {
  app.db.tx(() => {
    for (const t of [...EXPORT_TABLES, "source_connection", "push_subscription", "device_session", "setting", "notification_log", "account"]) {
      app.db.run(`DELETE FROM ${t}`);
    }
  });
  for (const d of ["fit", "backups"]) {
    const p = join(app.config.dataDir, d);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
    mkdirSync(p, { recursive: true });
  }
}
