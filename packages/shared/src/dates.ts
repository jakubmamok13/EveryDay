// Calendar dates are plain 'YYYY-MM-DD' strings in the athlete's time zone.
// All arithmetic goes through UTC midnight, so DST never shifts a date.

export type ISODate = string;

export function parseDate(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!));
}

export function formatDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = parseDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return formatDate(x);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/** 1 = Monday … 7 = Sunday */
export function weekday(d: ISODate): number {
  const w = parseDate(d).getUTCDay();
  return w === 0 ? 7 : w;
}

export function mondayOf(d: ISODate): ISODate {
  return addDays(d, 1 - weekday(d));
}

/** Local date and HH:MM for an instant in the given IANA time zone. */
export function localDateTime(now: Date, timeZone: string): { date: ISODate; time: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const time = `${get("hour")}:${get("minute")}`;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const WEEKDAY_PL = ["", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"] as const;
export const WEEKDAY_PL_LONG = ["", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"] as const;
