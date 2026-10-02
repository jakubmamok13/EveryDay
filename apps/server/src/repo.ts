import type {
  AvailabilityDay,
  ChatNote,
  CheckIn,
  Goal,
  ISODate,
  Physiology,
  PlannedDay,
  RideMode,
  ScaledWorkout,
  WellnessDay,
} from "@everyday/shared";
import type { Ladder } from "@everyday/engine";
import type { App } from "./app";
import { nowIso, type Row } from "./db";

// Typed reads/writes shared by the services.

export interface PlannedRow {
  id: number;
  date: ISODate;
  workout_slug: string;
  role: PlannedDay["role"];
  is_key: number;
  origin: string;
  workout_json: string;
  ride_mode: RideMode;
  ride_mode_source: string;
  status: string;
  icu_event_id: string | null;
  delivery_status: string;
  version: number;
  plan_id: number | null;
}

/** Statuses that mean "this row is the day's workout". */
export const ACTIVE = "('planned','completed','partial')";
export const VISIBLE = "('planned','completed','partial','skipped','missed')";

export function physiologyOn(app: App, athleteId: number, date: ISODate): Physiology {
  const r = app.db.get(
    "SELECT * FROM fitness_snapshot WHERE athlete_id = ? AND effective_from <= ? ORDER BY effective_from DESC, id DESC LIMIT 1",
    athleteId, date,
  ) ?? app.db.get("SELECT * FROM fitness_snapshot WHERE athlete_id = ? ORDER BY effective_from ASC LIMIT 1", athleteId);
  return {
    ftp: r?.ftp_w ?? 200,
    lthr: r?.lthr_bpm ?? null,
    maxHr: r?.max_hr_bpm ?? null,
    weightKg: r?.weight_kg ?? null,
  };
}

export function addSnapshot(app: App, athleteId: number, date: ISODate, p: Partial<Physiology>, source: string, note?: string): void {
  const cur = physiologyOn(app, athleteId, date);
  const next = { ...cur, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null)) } as Physiology;
  app.db.run(
    "INSERT INTO fitness_snapshot (athlete_id, effective_from, ftp_w, lthr_bpm, max_hr_bpm, weight_kg, source, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    athleteId, date, next.ftp, next.lthr, next.maxHr, next.weightKg, source, note ?? null, nowIso(),
  );
}

export function goals(app: App, athleteId: number): Goal[] {
  return app.db.all("SELECT * FROM goal WHERE athlete_id = ? AND status = 'active' ORDER BY role", athleteId).map((g) => {
    const t = g.target_json ? JSON.parse(g.target_json) : {};
    return {
      role: g.role,
      type: g.type,
      ...(g.event_name ? { eventName: g.event_name } : {}),
      ...(g.event_date ? { eventDate: g.event_date } : {}),
      ...(g.priority ? { priority: g.priority } : {}),
      ...t,
    } as Goal;
  });
}

export interface AvailabilityInfo {
  id: number;
  longRideDaysAllowed: boolean;
  longRideEveryWeeks: number;
  days: AvailabilityDay[];
}

export function availability(app: App, athleteId: number): AvailabilityInfo {
  const a = app.db.get("SELECT * FROM availability WHERE athlete_id = ? ORDER BY id DESC LIMIT 1", athleteId);
  if (!a) {
    return {
      id: 0,
      longRideDaysAllowed: false,
      longRideEveryWeeks: 5,
      days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, available: false, maxMinutes: 0, defaultRideMode: "indoor", notifyTime: "07:00" })),
    };
  }
  const days = app.db.all("SELECT * FROM availability_day WHERE availability_id = ? ORDER BY weekday", a.id).map((d) => ({
    weekday: d.weekday,
    available: !!d.available,
    maxMinutes: d.max_minutes,
    defaultRideMode: d.default_ride_mode as RideMode,
    notifyTime: d.notify_time,
  }));
  return { id: a.id, longRideDaysAllowed: !!a.long_ride_days_allowed, longRideEveryWeeks: a.long_ride_every_weeks, days };
}

export function ladder(app: App, athleteId: number): Ladder {
  return JSON.parse(app.db.get("SELECT ladder_json FROM athlete WHERE id = ?", athleteId)?.ladder_json ?? "{}");
}
export function setLadder(app: App, athleteId: number, l: Ladder): void {
  app.db.run("UPDATE athlete SET ladder_json = ? WHERE id = ?", JSON.stringify(l), athleteId);
}

export function toPlannedDay(r: PlannedRow): PlannedDay {
  return { date: r.date, isKey: !!r.is_key, role: r.role, workout: JSON.parse(r.workout_json) as ScaledWorkout };
}

export function plannedActiveOn(app: App, athleteId: number, date: ISODate): PlannedRow | undefined {
  return app.db.get<PlannedRow>(`SELECT * FROM planned_workout WHERE athlete_id = ? AND date = ? AND status IN ${ACTIVE} ORDER BY role = 'bonus', id LIMIT 1`, athleteId, date);
}

export function plannedBetween(app: App, athleteId: number, from: ISODate, to: ISODate, statuses = ACTIVE): PlannedRow[] {
  return app.db.all<PlannedRow>(`SELECT * FROM planned_workout WHERE athlete_id = ? AND date BETWEEN ? AND ? AND status IN ${statuses} ORDER BY date, id`, athleteId, from, to);
}

export function wellnessRange(app: App, athleteId: number, from: ISODate, to: ISODate): WellnessDay[] {
  return app.db.all("SELECT * FROM wellness_day WHERE athlete_id = ? AND date BETWEEN ? AND ? ORDER BY date", athleteId, from, to).map((w) => ({
    date: w.date,
    hrv: w.hrv,
    restingHr: w.resting_hr,
    sleepSeconds: w.sleep_seconds,
    sleepScore: w.sleep_score,
    bodyBatteryMax: w.body_battery_max,
    bodyBatteryMin: w.body_battery_min,
    garminReadiness: w.garmin_readiness,
    weightKg: w.weight_kg,
  }));
}

export function checkIn(app: App, athleteId: number, date: ISODate): CheckIn | null {
  const c = app.db.get("SELECT * FROM check_in WHERE athlete_id = ? AND date = ?", athleteId, date);
  if (!c) return null;
  return {
    date,
    sleepQuality: c.sleep_quality,
    legs: c.legs,
    motivation: c.motivation,
    sick: !!c.sick,
    pain: !!c.pain,
    ...(c.pain_note ? { painNote: c.pain_note } : {}),
    rideMode: c.ride_mode,
  };
}

export function activeNotes(app: App, athleteId: number, date: ISODate): ChatNote[] {
  return app.db
    .all("SELECT * FROM chat_note WHERE athlete_id = ? AND deleted_at IS NULL AND start_date <= ? AND end_date >= ? ORDER BY id", athleteId, date, date)
    .map((n) => ({ id: n.id, kind: n.kind, text: n.text, startDate: n.start_date, endDate: n.end_date }));
}

export function dailyState(app: App, athleteId: number, date: ISODate): Row | undefined {
  return app.db.get("SELECT * FROM daily_state WHERE athlete_id = ? AND date = ?", athleteId, date);
}

export function logJob<T>(app: App, job: string, fn: () => Promise<T>): Promise<T> {
  const id = app.db.run("INSERT INTO job_run (job, started_at, status) VALUES (?, ?, 'running')", job, nowIso()).id;
  return fn().then(
    (r) => {
      app.db.run("UPDATE job_run SET finished_at = ?, status = 'ok' WHERE id = ?", nowIso(), id);
      return r;
    },
    (e) => {
      app.db.run("UPDATE job_run SET finished_at = ?, status = 'error', error_code = ? WHERE id = ?", nowIso(), String(e?.code ?? e?.message ?? e).slice(0, 120), id);
      throw e;
    },
  );
}
