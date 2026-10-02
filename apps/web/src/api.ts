// Thin client for the EveryDay server (same origin, session cookie).

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(data?.error ?? `Błąd ${res.status}`, res.status);
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => req<T>("GET", p),
  post: <T = any>(p: string, b: unknown = {}) => req<T>("POST", p, b),
  put: <T = any>(p: string, b: unknown) => req<T>("PUT", p, b),
  patch: <T = any>(p: string, b: unknown) => req<T>("PATCH", p, b),
  del: <T = any>(p: string) => req<T>("DELETE", p),
};

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
