import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";
import { App, createRouter, Db, type Note, type Router } from "@everyday/core";

// Everything runs on this phone (D-043): SQLite (sql.js) in memory, saved to
// IndexedDB after every change. Demo data lives under a separate key.

export type Mode = "real" | "demo";

const NOTE_FILES = import.meta.glob("../../../knowledge/method-notes/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
export const NOTES: Note[] = Object.entries(NOTE_FILES)
  .map(([path, text]) => ({ path: path.split("/").pop()!, text }))
  .sort((a, b) => a.path.localeCompare(b.path));

// ---------- IndexedDB (one store, a few keys) ----------

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("everyday", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbDo<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("files", mode);
    const req = fn(tx.objectStore("files"));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).finally(() => db.close());
}
const idbGet = <T>(key: string) => idbDo<T | undefined>("readonly", (s) => s.get(key));
const idbPut = (key: string, value: unknown) => idbDo<IDBValidKey>("readwrite", (s) => s.put(value, key));
const idbDel = (key: string) => idbDo<undefined>("readwrite", (s) => s.delete(key));

// ---------- runtime ----------

export interface Runtime {
  app: App;
  router: Router;
  mode: Mode;
  /** Write the database to IndexedDB now (normally 300 ms after a change). */
  flush: () => Promise<void>;
}

let started: Promise<Runtime> | null = null;
export const runtime = (): Promise<Runtime> => (started ??= start());

async function start(): Promise<Runtime> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const mode: Mode = (await idbGet<string>("mode")) === "demo" ? "demo" : "real";
  const key = mode === "demo" ? "db-demo" : "db";
  const bytes = await idbGet<Uint8Array>(key);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving = Promise.resolve();
  const flush = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    const data = db.export();
    saving = saving.then(() => idbPut(key, data)).then(() => undefined, (e) => console.error("[save]", e));
    return saving;
  };
  // Drive copy (D-067): 20 s after the last change; the core skips unchanged data.
  let backupTimer: ReturnType<typeof setTimeout> | undefined;
  let routerRef: Router | null = null; // set below, once the app exists
  const backupNow = () => {
    clearTimeout(backupTimer);
    backupTimer = undefined;
    // "everyday:changed" = CHANGED in api.ts (not imported: api.ts imports this file).
    void routerRef
      ?.handle("POST", "/api/backup/auto")
      .then((r) => (r as { result?: string })?.result === "conflict" && window.dispatchEvent(new Event("everyday:changed")), () => undefined);
  };
  const db: Db = new Db(bytes ? new SQL.Database(bytes) : new SQL.Database(), () => {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 300);
    clearTimeout(backupTimer);
    backupTimer = setTimeout(backupNow, 20_000);
  });
  // iOS may stop the app any time after it leaves the screen: save right away.
  const saveNow = () => {
    if (timer) void flush();
    if (backupTimer) backupNow();
  };
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveNow());
  window.addEventListener("pagehide", saveNow);

  // Ask the browser not to evict our data (Home Screen apps on iOS are exempt anyway).
  void navigator.storage?.persist?.().catch(() => false);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw";
  const app = new App({ demo: mode === "demo", timeZone, notes: NOTES }, db);
  const router = createRouter(app);
  routerRef = router;
  if (mode === "demo" && !app.onboarded()) await router.handle("POST", "/api/demo/seed");
  return { app, router, mode, flush };
}

/** Switch between own data and demo data (each kept separately). */
export async function setMode(mode: Mode, resetDemo = false): Promise<void> {
  if (started) await (await started).flush();
  if (resetDemo) await idbDel("db-demo");
  await idbPut("mode", mode);
  location.reload();
}
