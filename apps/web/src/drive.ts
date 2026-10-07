import type { BackupStore, DriveCopy, ExportFile } from "@everyday/core";

// Google Drive, straight from the phone (D-068, ported from Paragraf).
//
// Access: the "drive.file" scope – the app sees only the files and folders it
// created itself, never the rest of your Drive. Sign-in is a full-page redirect
// to Google and back (OAuth 2.0 for client-side apps); it works in an app added
// to the iPhone Home Screen, where pop-ups do not. The access token lasts an
// hour and is renewed by another redirect, silently once you have agreed.
// EveryDay has its own OAuth client (not Paragraf's).

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_MIME = "application/vnd.google-apps.folder";
export const GUIDE = "https://github.com/jakubmamok13/EveryDay/blob/master/docs/DYSK-GOOGLE.md";

// ---------- what this phone remembers (not in the database: never in a copy) ----------

export interface DriveConfig {
  /** OAuth client ID typed in on this device (else the one built into the app). */
  clientId: string;
  folderId: string | null;
  folderName: string | null;
  deviceName: string;
  /** This device's own file in the folder. */
  ownFileId: string | null;
  /** Google account, for the silent renewal. */
  email: string | null;
  token: string | null;
  tokenExpires: number;
  /** When a silent renewal was last tried (to never loop). */
  silentAt: number;
  /** Google said a click is needed (signed out, consent withdrawn). */
  needsLogin: boolean;
}

const KEY = "everyday.drive";

/**
 * The ID out of whatever was pasted: stray spaces, a line break from a copied
 * repository variable, quotes, a "Client ID:" label or the whole JSON file.
 */
export function normalizeClientId(raw: string | undefined | null): string {
  const m = /\d+-[a-z0-9]+\.apps\.googleusercontent\.com/i.exec(raw ?? "");
  return m ? m[0] : (raw ?? "").trim();
}
export const isClientId = (s: string): boolean => /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(s);
/** What is wrong with a pasted client ID, or null. */
export function clientIdProblem(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^GOCSPX-/i.test(v)) return "To jest sekret klienta, a potrzebny jest identyfikator klienta (kończy się na .apps.googleusercontent.com).";
  if (!isClientId(normalizeClientId(v))) return "To nie wygląda na identyfikator klienta Google (np. 1234567890-abc123.apps.googleusercontent.com).";
  return null;
}
const BUILT_IN_CLIENT_ID: string = normalizeClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);

function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "Tablet";
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return "Telefon";
  return "Komputer";
}

let cache: DriveConfig | null = null;
export function driveConfig(): DriveConfig {
  if (cache) return cache;
  let stored: Partial<DriveConfig> = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<DriveConfig>;
  } catch {
    /* private mode or a broken value: start over */
  }
  cache = {
    clientId: "",
    folderId: null,
    folderName: null,
    deviceName: guessDeviceName(),
    ownFileId: null,
    email: null,
    token: null,
    tokenExpires: 0,
    silentAt: 0,
    needsLogin: false,
    ...stored,
  };
  return cache;
}
export function saveDriveConfig(patch: Partial<DriveConfig>): DriveConfig {
  cache = { ...driveConfig(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: keeps working for this visit */
  }
  return cache;
}
export const clientId = (): string => normalizeClientId(driveConfig().clientId) || BUILT_IN_CLIENT_ID;
/** Where the ID in use comes from: typed in on this device, or built into the published app. */
export const clientIdSource = (): "device" | "build" | "none" => (driveConfig().clientId.trim() ? "device" : BUILT_IN_CLIENT_ID ? "build" : "none");
export const hasToken = (): boolean => Boolean(driveConfig().token) && driveConfig().tokenExpires > Date.now() + 60_000;
/** A folder was chosen on this phone (signed in or not). */
export const driveLinked = (): boolean => Boolean(clientId() && driveConfig().folderId);

/** The address Google sends you back to; it must be listed in the OAuth client exactly like this. */
export function redirectUri(): string {
  return location.origin + location.pathname.replace(/index\.html$/, "");
}

// ---------- sign-in ----------

/**
 * Goes to Google. interactive=false renews silently (no screen, if you agreed
 * before). `back` opens that screen again on return.
 */
export async function signIn(interactive: boolean, back: "settings" | null = null): Promise<void> {
  const id = clientId();
  if (!id) throw new Error("Brak identyfikatora klienta Google (Ustawienia › Kopia na Dysku Google).");
  if (!isClientId(id)) throw new Error(clientIdProblem(id) ?? "Nieprawidłowy identyfikator klienta Google.");
  const state = crypto.randomUUID();
  // A silent attempt that never comes back (Google showed an error page) must not be
  // retried on every opening: until a token arrives, ask for a click instead.
  const cfg = saveDriveConfig(interactive ? {} : { silentAt: Date.now(), needsLogin: true });
  try {
    localStorage.setItem(`${KEY}.state`, state);
    if (back) localStorage.setItem(`${KEY}.back`, back);
    else localStorage.removeItem(`${KEY}.back`);
  } catch {
    /* without it the answer is refused below (state mismatch) */
  }
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: DRIVE_SCOPE,
    include_granted_scopes: "true",
    state,
    prompt: interactive ? "select_account" : "none",
  });
  if (cfg.email) params.set("login_hint", cfg.email);
  // The page unloads: save the database first (it is normally written 300 ms after a change).
  const { runtime } = await import("./runtime");
  await (await runtime()).flush();
  location.assign(`${AUTH}?${params}`);
}

/**
 * Reads Google's answer from the address (#access_token=… or #error=…) when the
 * app opens after a sign-in, and removes it from the address bar. Runs before
 * the app renders (main.tsx), because the tabs also live in the address hash.
 */
export function consumeSignIn(): "ok" | "needs-login" | "error" | null {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  if (!/(^|&)(access_token|error)=/.test(hash)) return null;
  const p = new URLSearchParams(hash);
  let expected: string | null = null;
  let back: string | null = null;
  try {
    expected = localStorage.getItem(`${KEY}.state`);
    back = localStorage.getItem(`${KEY}.back`);
    localStorage.removeItem(`${KEY}.state`);
    localStorage.removeItem(`${KEY}.back`);
  } catch {
    /* ignore */
  }
  history.replaceState(null, "", location.pathname + location.search + (back === "settings" ? "#settings" : ""));
  if (!expected || p.get("state") !== expected) return "error";
  const token = p.get("access_token");
  if (token) {
    const granted = (p.get("scope") ?? DRIVE_SCOPE).split(" ");
    if (!granted.includes(DRIVE_SCOPE)) {
      saveDriveConfig({ needsLogin: true });
      return "needs-login";
    }
    saveDriveConfig({ token, tokenExpires: Date.now() + Number(p.get("expires_in") ?? 3600) * 1000, needsLogin: false });
    return "ok";
  }
  const error = p.get("error") ?? "";
  // interaction_required, login_required, consent_required, account_selection_required…
  saveDriveConfig({ token: null, tokenExpires: 0, needsLogin: true });
  return /required$/.test(error) || error === "access_denied" ? "needs-login" : "error";
}

/** Is Google reachable? A redirect while offline would leave you on an error page. */
async function online(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    await fetch("https://accounts.google.com/generate_204", { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * On opening the app: with a folder chosen and an expired sign-in, renew it
 * with a quick silent trip to Google (at most every few minutes). Returns
 * "redirecting" when the page is about to leave.
 */
export async function ensureDriveAccess(): Promise<"off" | "ok" | "redirecting" | "needs-login"> {
  if (!driveLinked()) return "off";
  const cfg = driveConfig();
  if (hasToken()) {
    if (!cfg.email) void whoAmI().then((email) => email && saveDriveConfig({ email }), () => undefined);
    return "ok";
  }
  if (!cfg.needsLogin && Date.now() - cfg.silentAt > 3 * 60_000 && (await online())) {
    await signIn(false);
    return "redirecting";
  }
  return "needs-login";
}

/** Forget the folder and the sign-in on this phone (the copies on Drive stay). */
export function forgetDrive(): void {
  saveDriveConfig({ token: null, tokenExpires: 0, folderId: null, folderName: null, ownFileId: null, needsLogin: false, email: null });
}

// ---------- Drive REST ----------

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const cfg = driveConfig();
  if (!hasToken()) throw new DriveError("Zaloguj się ponownie do Dysku Google.", 401);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${cfg.token}` } });
  } catch {
    throw new DriveError("Brak połączenia z Dyskiem Google.", 0);
  }
  if (res.status === 401) {
    saveDriveConfig({ token: null, tokenExpires: 0 });
    throw new DriveError("Zaloguj się ponownie do Dysku Google.", 401);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      /* not JSON */
    }
    const text =
      res.status === 404
        ? "Nie ma już tego pliku albo folderu na Dysku (usunięty?)."
        : res.status === 403 && /quota|storage/i.test(detail)
          ? "Brak miejsca na Dysku Google."
          : `Dysk Google odpowiedział błędem ${res.status}${detail ? `: ${detail}` : ""}.`;
    throw new DriveError(text, res.status);
  }
  return res;
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  appProperties?: Record<string, string>;
}

/** Your Google account's e-mail (used to renew the sign-in without asking). */
export async function whoAmI(): Promise<string> {
  const r = (await (await call(`${API}/about?fields=user(emailAddress)`)).json()) as { user?: { emailAddress?: string } };
  return r.user?.emailAddress ?? "";
}

/** Folders the app created (on any of your devices) – the only ones it can see. */
export async function listFolders(): Promise<DriveFile[]> {
  const q = encodeURIComponent(`mimeType = '${FOLDER_MIME}' and trashed = false`);
  const r = (await (await call(`${API}/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`)).json()) as { files: DriveFile[] };
  return r.files;
}

export async function createFolder(name: string): Promise<DriveFile> {
  const res = await call(`${API}/files?fields=id,name,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
  });
  return (await res.json()) as DriveFile;
}

async function listFolder(folderId: string): Promise<DriveFile[]> {
  // Fails with 404 when the folder was deleted.
  await call(`${API}/files/${folderId}?fields=id,trashed`).then(async (r) => {
    if (((await r.json()) as { trashed?: boolean }).trashed) throw new DriveError("Folder kopii jest w koszu na Dysku.", 404);
  });
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const r = (await (await call(`${API}/files?q=${q}&fields=files(id,name,modifiedTime,size,appProperties)&pageSize=200`)).json()) as { files: DriveFile[] };
  return r.files;
}

async function download(fileId: string): Promise<Uint8Array> {
  return new Uint8Array(await (await call(`${API}/files/${fileId}?alt=media`)).arrayBuffer());
}

const SIMPLE_LIMIT = 4.5 * 1024 * 1024;

/** Creates the file (fileId null) or replaces its content. Google keeps earlier versions of the file. */
async function upload(
  file: { fileId: string | null; name: string; folderId: string; appProperties: Record<string, string> },
  bytes: Uint8Array,
): Promise<DriveFile> {
  const meta = file.fileId
    ? { name: file.name, appProperties: file.appProperties }
    : { name: file.name, parents: [file.folderId], appProperties: file.appProperties, mimeType: "application/gzip" };
  const target = file.fileId ? `${UPLOAD}/files/${file.fileId}` : `${UPLOAD}/files`;
  const method = file.fileId ? "PATCH" : "POST";
  const fields = "fields=id,name,modifiedTime,appProperties";
  if (bytes.length <= SIMPLE_LIMIT) {
    const boundary = `everyday${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`,
      bytes as BlobPart,
      `\r\n--${boundary}--`,
    ]);
    const res = await call(`${target}?uploadType=multipart&${fields}`, { method, headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
    return (await res.json()) as DriveFile;
  }
  // Large (years of rides): resumable upload, the content in a second request.
  const init = await call(`${target}?uploadType=resumable&${fields}`, {
    method,
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/gzip", "X-Upload-Content-Length": String(bytes.length) },
    body: JSON.stringify(meta),
  });
  const session = init.headers.get("location");
  if (!session) throw new DriveError("Dysk Google nie przyjął przesyłania dużego pliku.", 0);
  const res = await call(session, { method: "PUT", headers: { "Content-Type": "application/gzip" }, body: bytes as BlobPart });
  return (await res.json()) as DriveFile;
}

// ---------- the copy files ----------

const FILE_PREFIX = "everyday-kopia-";
const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "urzadzenie";

async function gzip(text: string): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return new TextEncoder().encode(text);
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: Uint8Array): Promise<string> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

const toCopy = (f: DriveFile): DriveCopy | null =>
  f.appProperties?.everydayDevice
    ? { id: f.id, device: f.appProperties.everydayDevice, deviceName: f.appProperties.everydayDeviceName || "urządzenie", modifiedTime: f.modifiedTime }
    : null;

/** The folder as the core's copy logic sees it (packages/core/src/services/backup.ts). */
export const driveStore: BackupStore = {
  ready: () => hasToken() && driveLinked(),
  async list() {
    return (await listFolder(driveConfig().folderId!)).map(toCopy).filter((c): c is DriveCopy => !!c);
  },
  async load(id) {
    return JSON.parse(await gunzip(await download(id))) as ExportFile;
  },
  async save(device, file) {
    const cfg = driveConfig();
    let fileId = cfg.ownFileId;
    if (!fileId) fileId = (await this.list()).find((c) => c.device === device)?.id ?? null;
    const name = `${FILE_PREFIX}${slug(cfg.deviceName)}-${device.slice(-6)}.json.gz`;
    const props = { everydayDevice: device, everydayDeviceName: cfg.deviceName };
    let saved: DriveFile;
    try {
      saved = await upload({ fileId, name, folderId: cfg.folderId!, appProperties: props }, await gzip(JSON.stringify(file)));
    } catch (e) {
      // Our file was deleted on Drive: start a new one.
      if (!(e instanceof DriveError && e.status === 404 && fileId)) throw e;
      saved = await upload({ fileId: null, name, folderId: cfg.folderId!, appProperties: props }, await gzip(JSON.stringify(file)));
    }
    saveDriveConfig({ ownFileId: saved.id });
    return toCopy({ ...saved, appProperties: { ...props, ...saved.appProperties } })!;
  },
};
