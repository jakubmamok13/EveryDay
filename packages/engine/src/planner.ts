import {
  addDays,
  daysBetween,
  mondayOf,
  weekday,
  type AvailabilityDay,
  type BlockFocus,
  type Goal,
  type ISODate,
  type PlannedDay,
  type PlannedWeek,
  type ScaledWorkout,
  type WeekKind,
  type WorkoutCategory,
  type WorkoutDef,
} from "@everyday/shared";
import { fitnessAfterWeek, weeklyLoadCap } from "./load";
import { scaleWorkout, totalMinutes } from "./workouts";

export type Ladder = Partial<Record<WorkoutCategory, number>>;

export interface PlanInput {
  today: ISODate;
  /** Monday the plan (block 0, week 0) started. */
  planStart: ISODate;
  /** Monday of the first week to generate. */
  firstWeek: ISODate;
  weeks: number;
  goals: Goal[];
  availability: AvailabilityDay[];
  fitness: number;
  ladder: Ladder;
  longestRecentMinutes: number;
  library: WorkoutDef[];
  confirmedLongRides?: { date: ISODate; minutes: number }[];
  /** End-of-block ramp test in Recovery Weeks (D-036). */
  testInRecoveryWeek?: boolean;
  /** Max planned Fitness rise per week (our rule: 5). */
  rampPerWeek?: number;
}

type Role = "quality" | "long" | "endurance";

export function weekPosition(planStart: ISODate, weekStart: ISODate): { blockIndex: number; weekInBlock: number } {
  const weeks = Math.max(0, Math.floor(daysBetween(planStart, weekStart) / 7));
  return { blockIndex: Math.floor(weeks / 4), weekInBlock: weeks % 4 };
}

export function primaryGoal(goals: Goal[]): Goal {
  return goals.find((g) => g.role === "primary") ?? { role: "primary", type: "general_fitness" };
}

function eventGoal(goals: Goal[]): Goal | undefined {
  return goals.find((g) => g.type === "event" && g.eventDate);
}

export function blockFocus(goals: Goal[], blockIndex: number, weekStart: ISODate): BlockFocus {
  const ev = eventGoal(goals);
  if (ev && primaryGoal(goals).type === "event" && ev.eventDate) {
    const weeksTo = Math.floor(daysBetween(weekStart, ev.eventDate) / 7);
    if (weeksTo <= 1) return "taper";
    if (weeksTo <= 3) return "peak";
    if (weeksTo <= 11) return "build";
    return "base";
  }
  switch (primaryGoal(goals).type) {
    case "raise_ftp":
      return (["sweet_spot", "threshold", "vo2max"] as const)[blockIndex % 3]!;
    case "endurance":
      return (["base", "sweet_spot", "threshold"] as const)[blockIndex % 3]!;
    default:
      return "base";
  }
}

function weekKind(goals: Goal[], focus: BlockFocus, weekInBlock: number): WeekKind {
  if (focus === "taper") return "taper";
  return weekInBlock === 3 ? "recovery" : "load";
}

export function qualityCategories(focus: BlockFocus, blockIndex: number): WorkoutCategory[] {
  switch (focus) {
    case "sweet_spot":
      return ["sweet_spot", "sweet_spot"];
    case "threshold":
      return ["threshold", "sweet_spot"];
    case "vo2max":
      return ["vo2max", "threshold"];
    case "build":
      return blockIndex % 2 === 0 ? ["threshold", "vo2max"] : ["vo2max", "threshold"];
    case "peak":
      return ["vo2max", "threshold"];
    case "taper":
      return ["vo2max"];
    default:
      return ["tempo", "sweet_spot"];
  }
}

function qualityDayCount(goals: Goal[]): number {
  const t = primaryGoal(goals).type;
  return t === "raise_ftp" || t === "event" ? 2 : 1;
}

/**
 * Weekly roles from availability: the longest day is the long ride; quality
 * days avoid touching each other and, if possible, the long day.
 */
export function assignRoles(availability: AvailabilityDay[], qualityCount: number): Map<number, Role> {
  const days = availability.filter((d) => d.available && d.maxMinutes >= 30).sort((a, b) => a.weekday - b.weekday);
  const roles = new Map<number, Role>();
  if (days.length === 0) return roles;
  const maxMin = Math.max(...days.map((d) => d.maxMinutes));
  const longCandidates = days.filter((d) => d.maxMinutes === maxMin);
  const long = longCandidates.find((d) => d.weekday >= 6) ?? longCandidates[0]!;
  if (days.length >= 2 && long.maxMinutes >= 90) roles.set(long.weekday, "long");

  const adjacent = (a: number, b: number) => Math.abs(a - b) === 1 || Math.abs(a - b) === 6;
  const rest = days.filter((d) => !roles.has(d.weekday) && d.maxMinutes >= 40);
  // Prefer days not next to the long day, then earlier in the week.
  const ranked = [...rest].sort((a, b) => {
    const pa = roles.size && adjacent(a.weekday, long.weekday) ? 1 : 0;
    const pb = roles.size && adjacent(b.weekday, long.weekday) ? 1 : 0;
    return pa - pb || a.weekday - b.weekday;
  });
  const chosen: number[] = [];
  for (const d of ranked) {
    if (chosen.length >= qualityCount) break;
    if (chosen.some((c) => adjacent(c, d.weekday))) continue;
    chosen.push(d.weekday);
  }
  for (const w of chosen) roles.set(w, "quality");
  for (const d of days) if (!roles.has(d.weekday)) roles.set(d.weekday, "endurance");
  return roles;
}

function byCategory(library: WorkoutDef[], cat: WorkoutCategory): WorkoutDef[] {
  return library.filter((w) => w.category === cat && w.level >= 1).sort((a, b) => a.level - b.level);
}

export function findWorkout(library: WorkoutDef[], slug: string): WorkoutDef {
  const w = library.find((x) => x.slug === slug);
  if (!w) throw new Error(`Workout not in library: ${slug}`);
  return w;
}

/** Highest-level workout of the category at or below `level` that fits the time. */
export function pickWorkout(
  library: WorkoutDef[],
  cat: WorkoutCategory,
  level: number,
  maxMinutes: number,
  exclude?: string,
): WorkoutDef | undefined {
  const all = byCategory(library, cat).filter((w) => totalMinutes(w.steps) <= maxMinutes + 2);
  const fits = all.filter((w) => w.slug !== exclude).length ? all.filter((w) => w.slug !== exclude) : all;
  if (fits.length === 0) return undefined;
  const atOrBelow = fits.filter((w) => w.level <= level);
  return atOrBelow.length ? atOrBelow[atOrBelow.length - 1] : fits[0];
}

const round15 = (m: number) => Math.round(m / 15) * 15;

function endurance(library: WorkoutDef[], minutes: number): ScaledWorkout {
  if (minutes < 40) return scaleWorkout(findWorkout(library, "recovery-30"));
  return scaleWorkout(findWorkout(library, "endurance-z2"), { targetMinutes: minutes });
}

function longRide(library: WorkoutDef[], level: number, minutes: number): ScaledWorkout {
  const defs = byCategory(library, "long_ride");
  const pick = [...defs].reverse().find((w) => w.level <= level && totalMinutes(w.steps) <= minutes + 2) ?? defs[0]!;
  return scaleWorkout(pick, { targetMinutes: minutes });
}

/** Saturday long-ride length: grows 15 min per load week from the recent longest ride. */
export function longRideMinutes(longestRecent: number, weekInBlock: number, maxMinutes: number): number {
  const base = Math.max(90, Math.min(longestRecent, maxMinutes));
  return Math.min(maxMinutes, round15(base + 15 * (weekInBlock + 1)));
}

export function planWeeks(input: PlanInput): PlannedWeek[] {
  const ramp = input.rampPerWeek ?? 5;
  const qCount = qualityDayCount(input.goals);
  const roles = assignRoles(input.availability, qCount);
  const avail = new Map(input.availability.map((d) => [d.weekday, d]));
  const ev = eventGoal(input.goals);
  const weeks: PlannedWeek[] = [];
  let fitness = input.fitness;
  let lastLoadWeek = 0;

  for (let i = 0; i < input.weeks; i++) {
    const weekStart = addDays(mondayOf(input.firstWeek), i * 7);
    const { blockIndex, weekInBlock } = weekPosition(input.planStart, weekStart);
    const focus = blockFocus(input.goals, blockIndex, weekStart);
    const kind = weekKind(input.goals, focus, weekInBlock);
    const cats = qualityCategories(focus, blockIndex);
    const days: PlannedDay[] = [];
    let qualityIndex = 0;
    let firstQualitySlug: string | undefined;

    for (let wd = 1; wd <= 7; wd++) {
      const date = addDays(weekStart, wd - 1);
      const role = roles.get(wd);
      const day = avail.get(wd);
      if (!role || !day) continue;
      const max = day.maxMinutes;

      if (ev?.eventDate === date) continue; // event day: the race is the workout
      if (ev?.eventDate && addDays(date, 1) === ev.eventDate) {
        days.push({ date, isKey: false, role: "quality", workout: scaleWorkout(findWorkout(input.library, "openers")) });
        continue;
      }

      if (role === "quality") {
        const cat = cats[qualityIndex % cats.length]!;
        const second = qualityIndex > 0 && cats[0] === cat;
        qualityIndex++;
        if (kind === "recovery") {
          if (qualityIndex === 2 && input.testInRecoveryWeek && max >= 45) {
            days.push({ date, isKey: true, role: "test", workout: scaleWorkout(findWorkout(input.library, "ramp-test")) });
          } else {
            days.push({ date, isKey: false, role: "recovery", workout: scaleWorkout(findWorkout(input.library, max >= 45 ? "recovery-45" : "recovery-30")) });
          }
          continue;
        }
        if (kind === "taper") {
          const def = pickWorkout(input.library, "vo2max", 1, max) ?? findWorkout(input.library, "openers");
          days.push({ date, isKey: true, role: "quality", workout: scaleWorkout(def) });
          continue;
        }
        const base = input.ladder[cat] ?? 1;
        const level = Math.max(1, base + weekInBlock - (second ? 1 : 0));
        // The second session of the same category is a different workout (variety).
        const def = pickWorkout(input.library, cat, second ? Math.max(level, 2) : level, max, second ? firstQualitySlug : undefined);
        if (def && !firstQualitySlug) firstQualitySlug = def.slug;
        if (def) days.push({ date, isKey: true, role: "quality", workout: scaleWorkout(def) });
        else days.push({ date, isKey: false, role: "endurance", workout: endurance(input.library, Math.min(max, 60)) });
        continue;
      }

      if (role === "long") {
        if (kind === "recovery" || kind === "taper") {
          const m = Math.max(90, round15(longRideMinutes(input.longestRecentMinutes, 0, max) * (kind === "taper" ? 0.5 : 0.6)));
          days.push({ date, isKey: false, role: "endurance", workout: endurance(input.library, Math.min(max, m)) });
        } else {
          const level = Math.min(5, 1 + weekInBlock + Math.floor(blockIndex / 3));
          const minutes = longRideMinutes(input.longestRecentMinutes, weekInBlock, max);
          days.push({ date, isKey: true, role: "long", workout: longRide(input.library, level, minutes) });
        }
        continue;
      }

      // endurance day
      const pref = kind === "load" ? (max >= 120 ? Math.min(max, 150) : Math.min(max, 60)) : Math.min(max, kind === "taper" ? 60 : 75);
      days.push({ date, isKey: false, role: "endurance", workout: endurance(input.library, pref) });
    }

    // Confirmed Long Ride Days replace that day; the following day becomes easy.
    for (const lr of input.confirmedLongRides ?? []) {
      if (lr.date < weekStart || lr.date > addDays(weekStart, 6)) continue;
      const idx = days.findIndex((d) => d.date === lr.date);
      const lrd: PlannedDay = { date: lr.date, isKey: true, role: "long_ride_day", workout: longRide(input.library, 1, lr.minutes) };
      if (idx >= 0) days[idx] = lrd;
      else days.push(lrd);
      const next = days.findIndex((d) => d.date === addDays(lr.date, 1));
      if (next >= 0) days[next] = { date: days[next]!.date, isKey: false, role: "recovery", workout: endurance(input.library, 60) };
    }
    days.sort((a, b) => (a.date < b.date ? -1 : 1));

    // Ramp cap (our rule): shorten flexible endurance first, then the long ride.
    let total = days.reduce((s, d) => s + d.workout.load, 0);
    if (kind === "load") {
      const cap = Math.max(weeklyLoadCap(fitness, ramp), 150);
      while (total > cap) {
        const flex = days
          .filter((d) => d.role === "endurance" && d.workout.minutes > 60)
          .sort((a, b) => b.workout.minutes - a.workout.minutes)[0];
        const lng = days.find((d) => d.role === "long" && d.workout.minutes > 90);
        const target = flex ?? lng;
        if (!target) break;
        const m = target.workout.minutes - 15;
        target.workout = target.role === "long"
          ? longRide(input.library, Math.min(5, 1 + weekInBlock), m)
          : endurance(input.library, m);
        total = days.reduce((s, d) => s + d.workout.load, 0);
      }
      lastLoadWeek = total;
    }

    weeks.push({
      weekStart,
      kind,
      blockIndex,
      focus,
      targetLoad: Math.round(total),
      days: days.filter((d) => d.date >= input.today),
    });
    fitness = fitnessAfterWeek(fitness, total);
  }
  void lastLoadWeek;
  return weeks;
}

/** Hard means a session that needs fresh legs (quality, tests). */
export function isHard(day: Pick<PlannedDay, "workout"> | undefined): boolean {
  return !!day && day.workout.intensity === "hard";
}

export { weekday };
