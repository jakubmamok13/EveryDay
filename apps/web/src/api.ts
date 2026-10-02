import type { Method } from "@everyday/core";
import { runtime } from "./runtime";

// The "API" is the in-process router from @everyday/core: no server (D-043).

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function req<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const { router } = await runtime();
  try {
    return (await router.handle(method, path, body)) as T;
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    if (!err.statusCode) console.error(e);
    throw new ApiError(err.statusCode ? err.message : `Błąd: ${err.message}`, err.statusCode ?? 500);
  }
}

export const api = {
  get: <T = any>(p: string) => req<T>("GET", p),
  post: <T = any>(p: string, b: unknown = {}) => req<T>("POST", p, b),
  put: <T = any>(p: string, b: unknown) => req<T>("PUT", p, b),
  patch: <T = any>(p: string, b: unknown) => req<T>("PATCH", p, b),
  del: <T = any>(p: string) => req<T>("DELETE", p),
};

/** Data changed outside the current screen (catch-up sync, new day). */
export const CHANGED = "everyday:changed";

/** Save a file: share sheet on phones, download elsewhere. */
export async function saveFile(filename: string, content: string, type: string): Promise<void> {
  const file = new File([content], filename, { type });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iphone|ipad|android/i.test(navigator.userAgent)) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const WEEKDAYS = ["", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
export const WEEKDAYS_LONG = ["", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];

export function weekdayOf(date: string): number {
  const d = new Date(date + "T00:00:00Z").getUTCDay();
  return d === 0 ? 7 : d;
}

export function fmtDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${WEEKDAYS[weekdayOf(date)]} ${Number(d)}.${m}`;
}

export function fmtMinutes(m: number): string {
  if (m < 90) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function zoneClass(zone: number): string {
  return `z${Math.min(zone, 5)}`;
}
