import type { App } from "../app";
import { exportJson, importJson, type ExportFile } from "./data";

// Copy of all data in a folder on the athlete's own Google Drive (D-068,
// ported from Paragraf). The web app signs in to Google (scope drive.file) and
// supplies the store; this module decides when to save, when to ask and what
// to restore. Every device writes only its own file in the folder, so two
// devices never overwrite each other. A newer copy from another device is
// never overwritten silently and never merged: Today asks which data stays
// (two phones would otherwise both write workouts to intervals.icu).
// The intervals.icu key is never in a copy (data.ts).

/** One device's copy in the Drive folder. */
export interface DriveCopy {
  id: string;
  device: string;
  deviceName: string;
  /** Drive's own time of the last save (one clock for all devices). */
  modifiedTime: string;
}

/** Google Drive as seen by this module; supplied by the web app (drive.ts). */
export interface BackupStore {
  /** Signed in and a folder chosen. */
  ready(): boolean;
  list(): Promise<DriveCopy[]>;
  load(id: string): Promise<ExportFile>;
  /** Creates or replaces this device's file. */
  save(device: string, file: ExportFile): Promise<DriveCopy>;
}

const K = {
  device: "backup_device",
  hash: "backup_hash",
  /** modifiedTime of this device's last saved copy. */
  savedAt: "backup_saved_at",
  /** Newest copy of another device already loaded or answered. */
  seen: "backup_seen",
  error: "backup_error",
  conflict: "backup_conflict",
} as const;

/** Without local changes the folder is checked at most this often. */
const RECHECK_MS = 15 * 60_000;

export type AutoResult = "off" | "unchanged" | "saved" | "conflict" | "error";

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

const store = (app: App): BackupStore | null => (app.backupStore?.ready() ? app.backupStore : null);
const needStore = (app: App): BackupStore => store(app) ?? fail("Najpierw połącz Dysk Google (Ustawienia › Kopia na Dysku Google).");

export function deviceId(app: App): string {
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

const newest = (copies: DriveCopy[]) => [...copies].sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))[0] ?? null;

/** Another device saved after everything this device saved or answered. */
function newerElsewhere(app: App, copies: DriveCopy[]): DriveCopy | null {
  const me = deviceId(app);
  const other = newest(copies.filter((c) => c.device !== me));
  const own = copies.find((c) => c.device === me)?.modifiedTime ?? "";
  const seen = app.db.meta(K.seen) ?? "";
  return other && other.modifiedTime > seen && other.modifiedTime > own ? other : null;
}

const lastCheck = new WeakMap<App, number>();

export function backupStatus(app: App) {
  const err = app.db.meta(K.error);
  const conflict = app.db.meta(K.conflict);
  return {
    connected: !!store(app),
    device: deviceId(app),
    lastSavedAt: app.db.meta(K.savedAt) ?? null,
    error: err ? (JSON.parse(err) as { at: string; message: string }) : null,
    conflict: conflict ? (JSON.parse(conflict) as DriveCopy) : null,
  };
}

export async function listCopies(app: App): Promise<(DriveCopy & { own: boolean })[]> {
  const me = deviceId(app);
  return (await needStore(app).list()).map((c) => ({ ...c, own: c.device === me })).sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1));
}

/** Upload this device's data now (replaces only this device's file). */
export async function saveBackup(app: App): Promise<{ savedAt: string }> {
  const s = needStore(app);
  if (app.config.demo) fail("W trybie demo kopia na Dysku jest wyłączona.");
  const file = exportJson(app);
  const saved = await s.save(deviceId(app), file);
  app.db.tx(() => {
    app.db.setMeta(K.hash, hashOf(file));
    app.db.setMeta(K.savedAt, saved.modifiedTime);
    setOrClear(app, K.error, null);
    setOrClear(app, K.conflict, null);
  });
  lastCheck.set(app, Date.now());
  return { savedAt: saved.modifiedTime };
}

/**
 * After changes and on every open: save when the data changed, unless another
 * device saved a newer copy — then Today asks.
 */
export async function autoBackup(app: App): Promise<AutoResult> {
  const s = store(app);
  if (!s || app.config.demo || !app.onboarded()) return "off";
  if (app.db.meta(K.conflict)) return "conflict";
  const changed = hashOf(exportJson(app)) !== app.db.meta(K.hash);
  if (!changed && Date.now() - (lastCheck.get(app) ?? 0) < RECHECK_MS) return "unchanged";
  try {
    const other = newerElsewhere(app, await s.list());
    lastCheck.set(app, Date.now());
    if (other) {
      app.db.setMeta(K.conflict, JSON.stringify(other));
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
 * Right after a folder is chosen. A new phone (not set up yet) starts from the
 * newest copy; a phone with data asks when another device's copy is there;
 * otherwise this phone's copy goes up.
 */
export async function folderChosen(app: App): Promise<{ state: "restored" | "exists" | "saved" | "empty"; copy: DriveCopy | null }> {
  const s = needStore(app);
  const me = deviceId(app);
  const copies = await s.list();
  setOrClear(app, K.conflict, null);
  setOrClear(app, K.seen, null);
  const other = newest(copies.filter((c) => c.device !== me));
  if (!app.onboarded()) {
    const copy = newest(copies);
    if (!copy) return { state: "empty", copy: null };
    await restoreBackup(app, copy.id);
    return { state: "restored", copy };
  }
  if (other) {
    // Answered in Settings or later on Today: load that copy, or keep this phone's data.
    app.db.setMeta(K.conflict, JSON.stringify(other));
    return { state: "exists", copy: other };
  }
  await saveBackup(app);
  return { state: "saved", copy: null };
}

/** Replace this phone's data with a copy (default: the newest one of another device). */
export async function restoreBackup(app: App, id?: string): Promise<{ savedAt: string; onboarded: boolean }> {
  const s = needStore(app);
  const copies = await s.list();
  const me = deviceId(app);
  const copy = id ? copies.find((c) => c.id === id) : newest(copies.filter((c) => c.device !== me)) ?? newest(copies);
  if (!copy) fail("W folderze nie ma jeszcze kopii.", 404);
  importJson(app, await s.load(copy.id));
  app.db.tx(() => {
    app.db.setMeta(K.seen, copy.modifiedTime);
    // The restored data counts as saved only when it is this device's own copy.
    if (copy.device === me) app.db.setMeta(K.hash, hashOf(exportJson(app)));
    else setOrClear(app, K.hash, null);
    setOrClear(app, K.error, null);
    setOrClear(app, K.conflict, null);
  });
  return { savedAt: copy.modifiedTime, onboarded: app.onboarded() };
}

/** Keep this phone's data after a newer copy from another device: ours goes up. */
export async function keepLocal(app: App): Promise<{ savedAt: string }> {
  const conflict = app.db.meta(K.conflict);
  if (conflict) app.db.setMeta(K.seen, (JSON.parse(conflict) as DriveCopy).modifiedTime);
  setOrClear(app, K.conflict, null);
  return saveBackup(app);
}

/** Forget the folder on this phone (the copies on Drive stay). */
export function disconnectBackup(app: App): void {
  app.db.tx(() => {
    for (const k of [K.hash, K.savedAt, K.seen, K.error, K.conflict]) setOrClear(app, k, null);
  });
}

/** Today: a newer copy from another device, or no copy for 7 days. */
export function backupNotice(app: App) {
  if (app.config.demo || !store(app)) return null;
  const s = backupStatus(app);
  if (s.conflict) return { kind: "conflict" as const, savedAt: s.conflict.modifiedTime, deviceName: s.conflict.deviceName };
  const last = s.lastSavedAt ? Date.parse(s.lastSavedAt) : 0;
  if (s.error && Date.now() - last > 7 * 86_400_000) return { kind: "stale" as const, lastSavedAt: s.lastSavedAt, message: s.error.message };
  return null;
}
