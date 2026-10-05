import { addDays, mondayOf, weekday, type ISODate, type PlannedDay, type Readiness, type RideMode, type ScaledWorkout } from "@everyday/shared";
import { LIBRARY } from "@everyday/library";
import {
  advanceLadderAfterBlock,
  blockFocus,
  checkEnvelope,
  findWorkout,
  moveMissedKey,
  planWeeks,
  proposeLongRideDay,
  qualityCategories,
  scaleWorkout,
  toIntervalsText,
  weekPosition,
  type Proposal,
} from "@everyday/engine";
import type { App } from "../app";
import { nowIso, type Row } from "../db";
import {
  ACTIVE,
  availability,
  goals,
  ladder,
  plannedActiveOn,
  plannedBetween,
  setLadder,
  toPlannedDay,
  type PlannedRow,
} from "../repo";

const WEEKS_AHEAD = 4;

function activePlan(app: App, athleteId: number): Row | undefined {
  return app.db.get("SELECT * FROM training_plan WHERE athlete_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", athleteId);
}

function longestRecentMinutes(app: App, athleteId: number, today: ISODate): number {
  const r = app.db.get("SELECT MAX(moving_seconds) AS s FROM activity WHERE athlete_id = ? AND sport = 'ride' AND is_master = 1 AND date >= ?", athleteId, addDays(today, -42));
  return Math.round((r?.s ?? 0) / 60);
}

function fitnessOn(app: App, athleteId: number, date: ISODate): number {
  return app.db.get("SELECT fitness FROM daily_state WHERE athlete_id = ? AND date <= ? ORDER BY date DESC LIMIT 1", athleteId, date)?.fitness ?? 0;
}

function insertDays(app: App, athleteId: number, planId: number, days: PlannedDay[]): void {
  const avail = availability(app, athleteId);
  const now = nowIso();
  for (const d of days) {
    const def = avail.days.find((x) => x.weekday === weekday(d.date));
    app.db.run(
      `INSERT INTO planned_workout (athlete_id, plan_id, date, workout_slug, role, is_key, origin, workout_json, ride_mode, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      athleteId, planId, d.date, d.workout.slug, d.role, d.isKey ? 1 : 0, "engine", JSON.stringify(d.workout),
      def?.defaultRideMode ?? "indoor", now, now,
    );
  }
}

/** Create a plan if needed and keep 4 weeks planned ahead. */
export function ensurePlan(app: App, athleteId: number, reason = "onboarding"): void {
  const today = app.today();
  let plan = activePlan(app, athleteId);
  if (!plan) {
    const id = app.db.run("INSERT INTO training_plan (athlete_id, reason, status, starts_on, created_at) VALUES (?,?,?,?,?)",
      athleteId, reason, "active", mondayOf(today), nowIso()).id;
    plan = { id, starts_on: mondayOf(today) };
  }
  const lastWeek = app.db.get("SELECT MAX(week_start) AS w FROM plan_week WHERE plan_id = ?", plan.id)?.w as ISODate | undefined;
  const firstWeek = lastWeek ? addDays(lastWeek, 7) : mondayOf(today);
  const until = addDays(mondayOf(today), 7 * (WEEKS_AHEAD - 1));
  if (firstWeek > until) return;
  const weeks = Math.round((Date.parse(until) - Date.parse(firstWeek)) / (7 * 86_400_000)) + 1;
  const avail = availability(app, athleteId);
  const lr = app.db.all("SELECT proposed_date AS date, minutes FROM long_ride_proposal WHERE athlete_id = ? AND status = 'confirmed'", athleteId);
  const generated = planWeeks({
    today,
    planStart: plan.starts_on,
    firstWeek,
    weeks,
    goals: goals(app, athleteId),
    availability: avail.days,
    fitness: fitnessOn(app, athleteId, today),
    ladder: ladder(app, athleteId),
    longestRecentMinutes: longestRecentMinutes(app, athleteId, today),
    library: LIBRARY,
    confirmedLongRides: lr as { date: ISODate; minutes: number }[],
    testInRecoveryWeek: true,
  });
  app.db.tx(() => {
    for (const w of generated) {
      app.db.run(
        "INSERT OR IGNORE INTO plan_week (plan_id, week_start, kind, block_index, focus, target_load) VALUES (?,?,?,?,?,?)",
        plan!.id, w.weekStart, w.kind, w.blockIndex, w.focus, w.targetLoad,
      );
      const existing = new Set(plannedBetween(app, athleteId, w.weekStart, addDays(w.weekStart, 6), "('planned','completed','partial','skipped','missed')").map((r) => r.date));
      insertDays(app, athleteId, plan!.id, w.days.filter((d) => !existing.has(d.date)));
    }
  });
}

/** New plan from today after a Goal or Availability change (D-028). History is kept. */
export function regenerate(app: App, athleteId: number, reason: string): void {
  const today = app.today();
  const keepToday = !!app.db.get(
    "SELECT 1 FROM planned_workout WHERE athlete_id = ? AND date = ? AND status IN ('completed','partial')", athleteId, today,
  ) || !!app.db.get("SELECT 1 FROM check_in WHERE athlete_id = ? AND date = ?", athleteId, today);
  const from = keepToday ? addDays(today, 1) : today;
  app.db.tx(() => {
    app.db.run("UPDATE training_plan SET status = 'superseded' WHERE athlete_id = ? AND status = 'active'", athleteId);
    app.db.run(
      "UPDATE planned_workout SET status = 'replaced', delivery_status = 'pending', version = version + 1, updated_at = ? WHERE athlete_id = ? AND date >= ? AND status = 'planned'",
      nowIso(), athleteId, from,
    );
  });
  // Days that still have an active row (today, past days) are not planned again.
  ensurePlan(app, athleteId, reason);
}

// ---------- Calendar (intervals.icu → MyWhoosh / Wahoo / Garmin) ----------

export async function writeCalendar(app: App, athleteId: number, from: ISODate, to: ISODate): Promise<{ written: number; failed: number }> {
  const icu = app.icu();
  if (!icu) return { written: 0, failed: 0 };
  const rows = app.db.all<PlannedRow>(
    "SELECT * FROM planned_workout WHERE athlete_id = ? AND date BETWEEN ? AND ? AND delivery_status IN ('pending','failed')",
    athleteId, from, to,
  );
  let written = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      if (r.status === "planned") {
        const w = JSON.parse(r.workout_json) as ScaledWorkout;
        const ev = { date: r.date, name: w.name, description: toIntervalsText(w, r.ride_mode), minutes: w.minutes, load: w.load, indoor: r.ride_mode === "indoor" };
        if (r.icu_event_id) await icu.updateWorkout(r.icu_event_id, ev);
        else {
          const id = await icu.createWorkout(ev);
          app.db.run("UPDATE planned_workout SET icu_event_id = ? WHERE id = ?", id, r.id);
        }
      } else if (r.icu_event_id && ["skipped", "replaced", "missed"].includes(r.status)) {
        await icu.deleteWorkout(r.icu_event_id);
        app.db.run("UPDATE planned_workout SET icu_event_id = NULL WHERE id = ?", r.id);
      }
      app.db.run("UPDATE planned_workout SET delivery_status = 'written', delivered_at = ? WHERE id = ?", nowIso(), r.id);
      written++;
    } catch {
      app.db.run("UPDATE planned_workout SET delivery_status = 'failed' WHERE id = ?", r.id);
      failed++;
    }
  }
  return { written, failed };
}

export function writeCalendarSoon(app: App, athleteId: number, date: ISODate): void {
  void writeCalendar(app, athleteId, addDays(date, -1), addDays(date, 13)).catch(() => undefined);
}

// ---------- Changes with undo (D-014) ----------

interface Snapshot {
  id: number;
  date: ISODate;
  workout_json: string;
  status: string;
  ride_mode: string;
  is_key: number;
  role: string;
}

function snap(r: PlannedRow): Snapshot {
  return { id: r.id, date: r.date, workout_json: r.workout_json, status: r.status, ride_mode: r.ride_mode, is_key: r.is_key, role: r.role };
}

function touch(app: App, id: number, fields: Partial<Snapshot>): void {
  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
  app.db.run(
    `UPDATE planned_workout SET ${sets}${sets ? "," : ""} version = version + 1, delivery_status = 'pending', updated_at = ? WHERE id = ?`,
    ...(Object.values(fields) as (string | number)[]), nowIso(), id,
  );
}

function record(app: App, athleteId: number, date: ISODate, rowId: number | null, origin: string, action: string, before: Snapshot[], inserted: number[], reasons: string[], text: string): number {
  return app.db.run(
    "INSERT INTO adaptation (athlete_id, date, planned_workout_id, origin, action, before_json, after_json, reason_codes_json, text, applied_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    athleteId, date, rowId, origin, action, JSON.stringify(before), JSON.stringify({ inserted }), JSON.stringify(reasons), text, nowIso(),
  ).id;
}

/** Replace a day's workout (null = rest). */
export function applyChange(app: App, athleteId: number, row: PlannedRow, workout: ScaledWorkout | null, origin: string, action: string, reasons: string[], text: string): number {
  return app.db.tx(() => {
    const before = [snap(row)];
    if (workout === null) touch(app, row.id, { status: "skipped" });
    else touch(app, row.id, { workout_json: JSON.stringify(workout), status: "planned" });
    const id = record(app, athleteId, row.date, row.id, origin, action, before, [], reasons, text);
    writeCalendarSoon(app, athleteId, row.date);
    return id;
  });
}

/** Move a workout to another date; swaps with the workout already there. */
export function moveWorkout(app: App, athleteId: number, row: PlannedRow, toDate: ISODate, origin: string, reasons: string[], text: string): number {
  return app.db.tx(() => {
    const other = plannedActiveOn(app, athleteId, toDate);
    const before = [snap(row), ...(other ? [snap(other)] : [])];
    touch(app, row.id, { date: toDate });
    if (other) touch(app, other.id, { date: row.date });
    const id = record(app, athleteId, row.date, row.id, origin, other ? "swap" : "move", before, [], reasons, text);
    writeCalendarSoon(app, athleteId, row.date < toDate ? row.date : toDate);
    return id;
  });
}

export function insertWorkout(app: App, athleteId: number, date: ISODate, role: PlannedDay["role"], isKey: boolean, workout: ScaledWorkout, rideMode: RideMode, origin: string, reasons: string[], text: string): number {
  return app.db.tx(() => {
    const now = nowIso();
    const plan = activePlan(app, athleteId);
    const id = app.db.run(
      `INSERT INTO planned_workout (athlete_id, plan_id, date, workout_slug, role, is_key, origin, workout_json, ride_mode, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      athleteId, plan?.id ?? null, date, workout.slug, role, isKey ? 1 : 0, origin, JSON.stringify(workout), rideMode, now, now,
    ).id;
    const adapt = record(app, athleteId, date, id, origin, role === "bonus" ? "bonus" : "insert", [], [id], reasons, text);
    writeCalendarSoon(app, athleteId, date);
    return adapt;
  });
}

/**
 * Put a missed Key Workout on `to`, replacing what was there. Recorded under
 * `adaptationDate`, so undoing that day's changes also restores `to` (D-014).
 */
export function relocateKey(app: App, athleteId: number, adaptationDate: ISODate, to: ISODate, role: PlannedDay["role"], workout: ScaledWorkout, rideMode: RideMode, text: string): number {
  return app.db.tx(() => {
    const there = plannedActiveOn(app, athleteId, to);
    const before = there ? [snap(there)] : [];
    if (there) touch(app, there.id, { status: "replaced" });
    const now = nowIso();
    const plan = activePlan(app, athleteId);
    const id = app.db.run(
      `INSERT INTO planned_workout (athlete_id, plan_id, date, workout_slug, role, is_key, origin, workout_json, ride_mode, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      athleteId, plan?.id ?? null, to, workout.slug, role, 1, "engine", JSON.stringify(workout), there?.ride_mode ?? rideMode, now, now,
    ).id;
    const adaptation = record(app, athleteId, adaptationDate, id, "engine", "move_key", before, [id], ["missed"], text);
    writeCalendarSoon(app, athleteId, to);
    return adaptation;
  });
}

export function undo(app: App, athleteId: number, adaptationId: number): boolean {
  const a = app.db.get("SELECT * FROM adaptation WHERE id = ? AND athlete_id = ? AND undone_at IS NULL", adaptationId, athleteId);
  if (!a) return false;
  app.db.tx(() => {
    const before: Snapshot[] = JSON.parse(a.before_json ?? "[]");
    const inserted: number[] = JSON.parse(a.after_json ?? "{}").inserted ?? [];
    for (const s of before) touch(app, s.id, { date: s.date, workout_json: s.workout_json, status: s.status, ride_mode: s.ride_mode, is_key: s.is_key, role: s.role });
    for (const id of inserted) touch(app, id, { status: "replaced" });
    app.db.run("UPDATE adaptation SET undone_at = ? WHERE id = ?", nowIso(), adaptationId);
  });
  writeCalendarSoon(app, athleteId, a.date);
  return true;
}

export function setRideMode(app: App, athleteId: number, date: ISODate, mode: RideMode, source: string): void {
  const r = plannedActiveOn(app, athleteId, date);
  if (!r || r.ride_mode === mode) return;
  app.db.run("UPDATE planned_workout SET ride_mode = ?, ride_mode_source = ?, version = version + 1, delivery_status = 'pending', updated_at = ? WHERE id = ?",
    mode, source, nowIso(), r.id);
  writeCalendarSoon(app, athleteId, date);
}

// ---------- Safe Envelope for chat and AI (D-011) ----------

export function weekDays(app: App, athleteId: number, date: ISODate): PlannedRow[] {
  const mon = mondayOf(date);
  return plannedBetween(app, athleteId, mon, addDays(mon, 6));
}

export function envelopeCheck(app: App, athleteId: number, row: PlannedRow | null, p: Proposal, overrides: Readiness["overrides"], userRequested: boolean) {
  const rows = weekDays(app, athleteId, p.fromDate);
  const before = rows.map(toPlannedDay);
  const after = before
    .filter((d) => !(row && d.date === row.date))
    .concat(p.workout ? [{ date: p.date, isKey: !!row?.is_key, role: row?.role ?? "endurance", workout: p.workout }] : []);
  const avail = availability(app, athleteId).days.filter((d) => d.available).map((d) => d.weekday);
  return checkEnvelope(p, {
    before: row ? toPlannedDay(row) : null,
    availableWeekdays: avail,
    weekAfter: after.filter((d) => d.date >= mondayOf(p.fromDate) && d.date <= addDays(mondayOf(p.fromDate), 6)),
    weekPlannedLoad: before.reduce((s, d) => s + d.workout.load, 0),
    overrides,
    userRequested,
  });
}

// ---------- Night maintenance ----------

/** Missed workouts (R8-11) for days before today. */
export function handleMissed(app: App, athleteId: number): void {
  const today = app.today();
  const rows = app.db.all<PlannedRow>(
    "SELECT * FROM planned_workout WHERE athlete_id = ? AND date < ? AND date >= ? AND status = 'planned'", athleteId, today, addDays(today, -7),
  );
  const availableWeekdays = availability(app, athleteId).days.filter((d) => d.available).map((d) => d.weekday);
  for (const r of rows) {
    app.db.run("UPDATE planned_workout SET status = 'missed', delivery_status = 'pending', updated_at = ? WHERE id = ?", nowIso(), r.id);
    if (!r.is_key) continue;
    const later = plannedBetween(app, athleteId, today, addDays(mondayOf(r.date), 6)).map(toPlannedDay);
    const neighbours = plannedBetween(app, athleteId, addDays(today, -1), addDays(mondayOf(r.date), 7), "('planned','completed','partial')").map(toPlannedDay);
    const formPct = app.db.get("SELECT form_pct FROM daily_state WHERE athlete_id = ? AND date = ?", athleteId, today)?.form_pct ?? null;
    const missed = toPlannedDay(r);
    const to = moveMissedKey({ missed: { ...missed, date: addDays(today, -1) }, laterThisWeek: later, availableWeekdays, neighbours, formPct });
    if (!to || to < today) continue;
    relocateKey(app, athleteId, to, to, r.role, missed.workout, r.ride_mode, `przeniesiony trening kluczowy „${missed.workout.name}”`);
  }
}

/** After a finished block the focus categories climb one step on the ladder. */
export function advanceBlocks(app: App, athleteId: number): void {
  const plan = activePlan(app, athleteId);
  if (!plan) return;
  const { blockIndex, weekInBlock } = weekPosition(plan.starts_on, mondayOf(app.today()));
  const key = `ladder_block:${athleteId}:${plan.id}`;
  const done = Number(app.db.meta(key) ?? "0");
  if (blockIndex > done && weekInBlock === 0) {
    const prevFocus = blockFocus(goals(app, athleteId), blockIndex - 1, addDays(plan.starts_on, (blockIndex - 1) * 28));
    setLadder(app, athleteId, advanceLadderAfterBlock(ladder(app, athleteId), qualityCategories(prevFocus, blockIndex - 1)));
    app.db.setMeta(key, String(blockIndex));
  }
}

export function maybeProposeLongRide(app: App, athleteId: number): void {
  const avail = availability(app, athleteId);
  if (!avail.longRideDaysAllowed) return;
  if (app.db.get("SELECT id FROM long_ride_proposal WHERE athlete_id = ? AND status = 'proposed'", athleteId)) return;
  const sec = goals(app, athleteId).find((g) => g.type === "endurance");
  const target = sec?.targetMinutes ?? 0;
  if (!target) return;
  const today = app.today();
  const last = app.db.get("SELECT MAX(proposed_date) AS d FROM long_ride_proposal WHERE athlete_id = ? AND status IN ('confirmed','done')", athleteId)?.d ?? null;
  const longest = Math.round((app.db.get("SELECT MAX(moving_seconds) AS s FROM activity WHERE athlete_id = ? AND sport = 'ride' AND is_master = 1 AND date >= ?", athleteId, addDays(today, -84))?.s ?? 0) / 60);
  const p = proposeLongRideDay({ today, lastLongRideDay: last, everyWeeks: avail.longRideEveryWeeks, longestRideMinutes: longest, targetMinutes: target, availability: avail.days });
  if (p) app.db.run("INSERT INTO long_ride_proposal (athlete_id, proposed_date, minutes, created_at) VALUES (?,?,?,?)", athleteId, p.date, p.minutes, nowIso());
}

export function confirmLongRide(app: App, athleteId: number, id: number, confirm: boolean): void {
  const p = app.db.get("SELECT * FROM long_ride_proposal WHERE id = ? AND athlete_id = ? AND status = 'proposed'", id, athleteId);
  if (!p) return;
  app.db.run("UPDATE long_ride_proposal SET status = ?, decided_at = ? WHERE id = ?", confirm ? "confirmed" : "declined", nowIso(), id);
  if (!confirm) return;
  const row = plannedActiveOn(app, athleteId, p.proposed_date);
  const def = findWorkout(LIBRARY, "long-z2");
  const w = scaleWorkout(def, { targetMinutes: p.minutes });
  if (row) applyChange(app, athleteId, row, w, "engine", "long_ride_day", ["long_ride_day"], `Dzień długiej jazdy: ${w.name}`);
  else insertWorkout(app, athleteId, p.proposed_date, "long_ride_day", true, w, "outdoor", "engine", ["long_ride_day"], `Dzień długiej jazdy: ${w.name}`);
  const next = plannedActiveOn(app, athleteId, addDays(p.proposed_date, 1));
  if (next && next.status === "planned") {
    applyChange(app, athleteId, next, scaleWorkout(findWorkout(LIBRARY, "endurance-z2"), { targetMinutes: 60 }), "engine", "shorten", ["after_long_ride"], "spokojnie po Dniu długiej jazdy");
  }
}

export function alternatives(row: PlannedRow): ScaledWorkout[] {
  const cur = JSON.parse(row.workout_json) as ScaledWorkout;
  return LIBRARY.filter((w) => w.category === cur.category && w.slug !== cur.slug && w.level >= 1)
    .map((w) => scaleWorkout(w, cur.category === "endurance" || cur.category === "long_ride" ? { targetMinutes: cur.minutes } : {}))
    .filter((w) => w.minutes <= cur.minutes + 5);
}

export { ACTIVE };
