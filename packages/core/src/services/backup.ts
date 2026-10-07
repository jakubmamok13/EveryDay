import type { App } from "../app";
import { exportJson, importJson, type ExportFile } from "./data";

// Copy of all data on the athlete's own Google Drive (D-067), through a small
// Google Apps Script web app the athlete deploys from tools/everyday-kopia.gs
// ("Execute as: me", "Who has access: Anyone"). The script URL is the only
// key: whoever has it can read and overwrite the copy. Requests are "simple"
// CORS requests (GET, POST text/plain) because Apps Script answers no
// preflight. The intervals.icu key is never in the copy (data.ts).

const K = {
  url: "backup_url",
  device: "backup_device",
  hash: "backup_hash",
  savedAt: "backup_saved_at",
  seen: "backup_seen",
  error: "backup_error",
  conflict: "backup_conflict",
} as const;

/** Without local changes the Drive copy is checked at most this often. */
const RECHECK_MS = 15 * 60_000;

export interface RemoteMeta {
  empty: boolean;
  savedAt: string | null;
  device: string | null;
}

export type AutoResult = "off" | "unchanged" | "saved" | "conflict" | "error";

function fail(message: string, statusCode = 502): never {
  throw Object.assign(new Error(message), { statusCode });
}

/** Deployed Apps Script web app address (…/macros/s/<id>/exec). */
export function isScriptUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/.test(url);
}

const fetcher = (app: App): typeof fetch => app.fetch ?? globalThis.fetch.bind(globalThis);

async function call(app: App, url: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    // No custom headers or cache mode: anything else could trigger a preflight.
    res = await fetcher(app)(url, { ...init, redirect: "follow" });
  } catch {
    fail("Brak połączenia z Dyskiem Google.");
  }
  if (!res.ok) fail(`Dysk Google odpowiedział błędem ${res.status}. Sprawdź, czy wdrożenie ma dostęp „Każdy”.`);
  let json: any;
  try {
    json = JSON.parse(await res.text());
  } catch {
    fail("Pod tym adresem nie ma skryptu kopii EveryDay (odpowiedź nie jest JSON). Sprawdź dostęp „Każdy” i adres kończący się na /exec.");
  }
  if (!json?.ok) fail(json?.error ?? "Skrypt kopii zwrócił błąd.");
  return json;
}

export async function remoteMeta(app: App, url: string): Promise<RemoteMeta> {
  const j = await call(app, `${url}?op=meta&t=${Date.now()}`);
  return { empty: !!j.empty, savedAt: j.savedAt ?? null, device: j.device ?? null };
}

function deviceId(app: App): string {
  let id = app.db.meta(K.device);
  if (!id) {
    id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    app.db.setMeta(K.device, id);
  }
  return id;
}

/** FNV-1a of the data (not of the export time), to skip unchanged uploads. */
function hashOf(file: ExportFile): string {
  const s = JSON.stringify([file.tables, file.meta ?? {}]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}-${s.length}`;
}

const setOrClear = (app: App, key: string, value: string | null) => {
  if (value !== null) app.db.setMeta(key, value);
  else if (app.db.meta(key) !== undefined) app.db.run("DELETE FROM meta WHERE key = ?", key);
};

/** Another device saved after the last copy this phone knows about. */
function newerElsewhere(app: App, m: RemoteMeta): boolean {
  if (m.empty || !m.savedAt || m.device === deviceId(app)) return false;
  const seen = app.db.meta(K.seen);
  return !seen || m.savedAt > seen;
}

export function backupStatus(app: App) {
  const url = app.db.meta(K.url) ?? null;
  const err = app.db.meta(K.error);
  const conflict = app.db.meta(K.conflict);
  return {
    connected: !!url,
    url,
    lastSavedAt: app.db.meta(K.savedAt) ?? null,
    error: err ? (JSON.parse(err) as { at: string; message: string }) : null,
    conflict: conflict ? (JSON.parse(conflict) as RemoteMeta) : null,
  };
}

/** Upload the current data now (overwrites the Drive copy). */
export async function saveBackup(app: App): Promise<{ savedAt: string }> {
  const url = app.db.meta(K.url) ?? fail("Najpierw połącz kopię na Dysku Google.", 400);
  if (app.config.demo) fail("W trybie demo kopia na Dysku jest wyłączona.", 400);
  const file = exportJson(app);
  const savedAt = new Date().toISOString();
  // A string body is sent as text/plain: a simple request without preflight.
  await call(app, url, { method: "POST", body: JSON.stringify({ op: "save", device: deviceId(app), savedAt, data: file }) });
  app.db.tx(() => {
    app.db.setMeta(K.hash, hashOf(file));
    app.db.setMeta(K.savedAt, savedAt);
    app.db.setMeta(K.seen, savedAt);
    setOrClear(app, K.error, null);
    setOrClear(app, K.conflict, null);
  });
  lastCheck.set(app, Date.now());
  return { savedAt };
}

const lastCheck = new WeakMap<App, number>();

/**
 * After changes and on every open: save when the data changed, unless a
 * newer copy from another device is on Drive — then ask (Today card).
 */
export async function autoBackup(app: App): Promise<AutoResult> {
  const url = app.db.meta(K.url);
  if (!url || app.config.demo || !app.onboarded()) return "off";
  if (app.db.meta(K.conflict)) return "conflict";
  const changed = hashOf(exportJson(app)) !== app.db.meta(K.hash);
  if (!changed && Date.now() - (lastCheck.get(app) ?? 0) < RECHECK_MS) return "unchanged";
  try {
    const m = await remoteMeta(app, url);
    lastCheck.set(app, Date.now());
    if (newerElsewhere(app, m)) {
      app.db.setMeta(K.conflict, JSON.stringify(m));
      return "conflict";
    }
    if (!changed) return "unchanged";
    await saveBackup(app);
    return "saved";
  } catch (e) {
    app.db.setMeta(K.error, JSON.stringify({ at: new Date().toISOString(), message: (e as Error).message }));
    return "error";
  }
}

/**
 * Link a Drive copy. Empty copy → upload this phone's data. A copy that
 * already exists is never overwritten silently: the caller decides
 * (restore it, or replace it with this phone's data).
 */
export async function connectBackup(app: App, rawUrl: string): Promise<{ state: "saved" | "exists"; remote: RemoteMeta }> {
  const url = String(rawUrl ?? "").trim();
  if (!isScriptUrl(url)) fail("Wklej adres wdrożenia skryptu: https://script.google.com/macros/s/…/exec", 400);
  const remote = await remoteMeta(app, url);
  app.db.tx(() => {
    app.db.setMeta(K.url, url);
    for (const k of [K.hash, K.savedAt, K.seen, K.error, K.conflict]) setOrClear(app, k, null);
  });
  if (!remote.empty) return { state: "exists", remote };
  if (app.onboarded() && !app.config.demo) await saveBackup(app);
  return { state: "saved", remote };
}

/** Replace this phone's data with the Drive copy (the intervals.icu key stays). */
export async function restoreBackup(app: App, rawUrl?: string): Promise<{ savedAt: string | null }> {
  const url = String(rawUrl ?? app.db.meta(K.url) ?? "").trim();
  if (!isScriptUrl(url)) fail("Wklej adres wdrożenia skryptu: https://script.google.com/macros/s/…/exec", 400);
  const j = await call(app, `${url}?op=load&t=${Date.now()}`);
  if (j.empty || !j.data) fail("Na Dysku nie ma jeszcze kopii.", 404);
  importJson(app, j.data as ExportFile);
  app.db.tx(() => {
    app.db.setMeta(K.url, url);
    app.db.setMeta(K.hash, hashOf(exportJson(app)));
    if (j.savedAt) app.db.setMeta(K.savedAt, j.savedAt);
    if (j.savedAt) app.db.setMeta(K.seen, j.savedAt);
    setOrClear(app, K.error, null);
    setOrClear(app, K.conflict, null);
  });
  lastCheck.set(app, Date.now());
  return { savedAt: j.savedAt ?? null };
}

/** Keep this phone's data after a conflict: it overwrites the Drive copy. */
export async function keepLocal(app: App): Promise<{ savedAt: string }> {
  setOrClear(app, K.conflict, null);
  return saveBackup(app);
}

export function disconnectBackup(app: App): void {
  app.db.tx(() => {
    for (const k of [K.url, K.hash, K.savedAt, K.seen, K.error, K.conflict]) setOrClear(app, k, null);
  });
}

/** Today: a newer copy from another device, or no copy for 7 days. */
export function backupNotice(app: App) {
  if (app.config.demo) return null;
  const s = backupStatus(app);
  if (!s.connected) return null;
  if (s.conflict) return { kind: "conflict" as const, savedAt: s.conflict.savedAt };
  const last = s.lastSavedAt ? Date.parse(s.lastSavedAt) : 0;
  if (s.error && Date.now() - last > 7 * 86_400_000) return { kind: "stale" as const, lastSavedAt: s.lastSavedAt, message: s.error.message };
  return null;
}
