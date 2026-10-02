import { addDays, daysBetween, mondayOf, weekday, type ISODate, type PlannedDay, type Readiness, type ScaledWorkout, type WorkoutDef } from "@everyday/shared";
import { findWorkout } from "./planner";
import { maxPct, reduceWorkout, scaleWorkout, shortenAndCap } from "./workouts";

// Adaptation rules (02 M5.3), missed-workout rule (M4.5) and the Safe Envelope (M5.4).

export type AdaptAction = "keep" | "reduce" | "shorten" | "recovery" | "rest" | "swap";

export interface AdaptResult {
  action: AdaptAction;
  reasons: string[];
  /** New workout for today; null = rest. */
  workout: ScaledWorkout | null;
  /** The Key Workout did not happen today → run the missed-workout rule. */
  keyMissed: boolean;
  /** Swap today with this later date (second Yellow day in a row). */
  swapWith?: ISODate;
}

export interface AdaptContext {
  date: ISODate;
  readiness: Readiness;
  planned: PlannedDay | null;
  /** Effective state yesterday (for "second Yellow in a row"). */
  yesterday?: Readiness["effective"] | null;
  /** Sick in the last 2 days but not today → return-after-illness rule. */
  recentlySick: boolean;
  /** Rest of this week's planned days (after today). */
  laterThisWeek: PlannedDay[];
  library: WorkoutDef[];
}

function recovery(library: WorkoutDef[], minutes: number): ScaledWorkout {
  return scaleWorkout(findWorkout(library, minutes >= 45 ? "recovery-45" : "recovery-30"));
}

export function adapt(ctx: AdaptContext): AdaptResult {
  const p = ctx.planned;
  if (!p) return { action: "keep", reasons: ["rest_day"], workout: null, keyMissed: false };
  const w = p.workout;
  const r = ctx.readiness;

  if (r.overrides.includes("sick")) {
    return { action: "rest", reasons: ["sick"], workout: null, keyMissed: p.isKey };
  }
  if (ctx.recentlySick && w.intensity !== "easy") {
    return { action: "shorten", reasons: ["return_after_illness"], workout: shortenAndCap(w, Math.min(1, 60 / w.minutes)), keyMissed: p.isKey };
  }
  if (r.overrides.includes("pain") && w.intensity !== "easy") {
    return { action: "shorten", reasons: ["pain"], workout: shortenAndCap(w, Math.min(1, 60 / w.minutes)), keyMissed: p.isKey };
  }

  switch (r.effective) {
    case "green":
      return { action: "keep", reasons: ["green"], workout: w, keyMissed: false };
    case "yellow": {
      if (p.isKey) {
        if (ctx.yesterday === "yellow") {
          const easyLater = ctx.laterThisWeek.find((d) => !d.isKey && d.workout.intensity === "easy");
          if (easyLater) {
            return { action: "swap", reasons: ["yellow_twice"], workout: easyLater.workout, keyMissed: false, swapWith: easyLater.date };
          }
        }
        return { action: "reduce", reasons: ["yellow"], workout: reduceWorkout(w), keyMissed: false };
      }
      if (w.intensity === "easy" && w.minutes <= 60) return { action: "keep", reasons: ["yellow_easy"], workout: w, keyMissed: false };
      return { action: "shorten", reasons: ["yellow"], workout: shortenAndCap(w, 0.75), keyMissed: false };
    }
    case "red": {
      if (r.score < 30) return { action: "rest", reasons: ["red"], workout: null, keyMissed: p.isKey };
      return { action: "recovery", reasons: ["red"], workout: recovery(ctx.library, Math.min(45, w.minutes)), keyMissed: p.isKey };
    }
  }
}

// ---------- Missed Key Workout (R8-11) ----------

export interface MissedContext {
  missed: PlannedDay;
  /** Planned days of the same week, after the missed date. */
  laterThisWeek: PlannedDay[];
  /** Weekdays that are available (1–7). */
  availableWeekdays: number[];
  /** All planned days around the week (to check hard-day neighbours). */
  neighbours: PlannedDay[];
  formPct: number | null;
}

/** Date to move a missed Key Workout to, or null (dropped). */
export function moveMissedKey(ctx: MissedContext): ISODate | null {
  if (ctx.formPct !== null && ctx.formPct < -0.3) return null;
  const sunday = addDays(mondayOf(ctx.missed.date), 6);
  const isHardOn = (date: ISODate) => ctx.neighbours.some((d) => d.date === date && d.workout.intensity === "hard");
  for (let date = addDays(ctx.missed.date, 1); date <= sunday; date = addDays(date, 1)) {
    if (!ctx.availableWeekdays.includes(weekday(date))) continue;
    const there = ctx.laterThisWeek.find((d) => d.date === date);
    if (there?.isKey) continue;
    if (ctx.missed.workout.intensity === "hard" && (isHardOn(addDays(date, -1)) || isHardOn(addDays(date, 1)))) continue;
    return date;
  }
  return null;
}

// ---------- Safe Envelope (D-011, R8-12) ----------

export interface Proposal {
  /** Date the change applies to (for a move: the new date). */
  date: ISODate;
  fromDate: ISODate;
  /** null = rest */
  workout: ScaledWorkout | null;
}

export interface EnvelopeContext {
  before: PlannedDay | null;
  availableWeekdays: number[];
  /** All planned days of the week after applying the proposal. */
  weekAfter: PlannedDay[];
  weekPlannedLoad: number;
  overrides: Readiness["overrides"];
  /** The athlete asked for it (chat / buttons): shorter than −20% is allowed. */
  userRequested?: boolean;
}

const RANK = { easy: 0, moderate: 1, hard: 2 } as const;
const EASIER_CATEGORIES = new Set(["recovery", "endurance"]);

export function checkEnvelope(p: Proposal, ctx: EnvelopeContext): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const before = ctx.before;
  const after = p.workout;
  if (after === null) return { ok: true, reasons };
  if (!before) reasons.push("no_planned_workout");
  else {
    if (Math.abs(daysBetween(p.fromDate, p.date)) > 1) reasons.push("move_too_far");
    const sameCategory = after.category === before.workout.category;
    if (!sameCategory && !EASIER_CATEGORIES.has(after.category)) reasons.push("category_change");
    const shorterByUser = ctx.userRequested && after.minutes <= before.workout.minutes;
    if (sameCategory && !shorterByUser && Math.abs(after.minutes - before.workout.minutes) > before.workout.minutes * 0.2 + 0.5) reasons.push("duration_change");
    if (!sameCategory && after.minutes > before.workout.minutes * 1.2 + 0.5) reasons.push("duration_change");
    if (RANK[after.intensity] > RANK[before.workout.intensity]) reasons.push("harder");
    if (maxPct(after.steps) > maxPct(before.workout.steps) + 0.5) reasons.push("harder");
  }
  if (!ctx.availableWeekdays.includes(weekday(p.date))) reasons.push("unavailable_day");
  const load = ctx.weekAfter.reduce((s, d) => s + d.workout.load, 0);
  if (load > ctx.weekPlannedLoad + 1) reasons.push("week_load");
  const hard = ctx.weekAfter.filter((d) => d.workout.intensity === "hard").map((d) => d.date).sort();
  for (let i = 1; i < hard.length; i++) if (daysBetween(hard[i - 1]!, hard[i]!) === 1) reasons.push("hard_days_in_a_row");
  if (ctx.overrides.includes("sick")) reasons.push("sick");
  if (ctx.overrides.includes("pain") && after.intensity !== "easy") reasons.push("pain");
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}
