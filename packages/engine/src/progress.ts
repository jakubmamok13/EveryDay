import { addDays, daysBetween, weekday, type AvailabilityDay, type Feel, type ISODate, type SeasonEvent, type WorkoutCategory } from "@everyday/shared";
import { inEventWindow, type Ladder } from "./planner";
import { effortScore, type Completed, type Effort } from "./insights";

// Progression from ride feedback (M4.6), FTP suggestions (M12), compliance.

export interface RatedRide {
  date: ISODate;
  category: WorkoutCategory;
  compliancePct: number | null;
  feel: Feel | null;
  /** 5-step rating (B2); preferred over `feel` when present. */
  effort?: Effort | null;
  completed?: Completed | null;
}

const LADDER_CATEGORIES: WorkoutCategory[] = ["tempo", "sweet_spot", "threshold", "vo2max", "anaerobic", "long_ride"];

/**
 * Progression from the post-ride rating (our rule, TrainerRoad-style survey):
 * score easy +1, moderate +0.5, hard 0, very hard −0.5, all out −1, not
 * completed −1. +1 step when the last two rides score ≥ 1.5 together with
 * compliance ≥ 90%; −1 step when the last one scores ≤ −1, the last two ≤ −1
 * together, or compliance < 80%.
 */
export function progressLadder(ladder: Ladder, rides: RatedRide[]): { ladder: Ladder; changes: { category: WorkoutCategory; delta: number }[] } {
  const next: Ladder = { ...ladder };
  const changes: { category: WorkoutCategory; delta: number }[] = [];
  const score = (r: RatedRide) => effortScore(r.effort ?? null, r.completed ?? null, r.feel);
  for (const cat of LADDER_CATEGORIES) {
    const recent = rides.filter((r) => r.category === cat).sort((a, b) => (a.date < b.date ? 1 : -1));
    const last = recent[0];
    if (!last) continue;
    const prev = recent[1];
    const two = score(last) + (prev ? score(prev) : 0);
    let delta = 0;
    if (score(last) <= -1 || (prev && two <= -1) || (last.compliancePct !== null && last.compliancePct < 80)) delta = -1;
    else if (prev && two >= 1.5 && (last.compliancePct ?? 100) >= 90 && (prev.compliancePct ?? 100) >= 90) delta = 1;
    if (delta !== 0) {
      next[cat] = Math.max(1, (next[cat] ?? 1) + delta);
      changes.push({ category: cat, delta });
    }
  }
  return { ladder: next, changes };
}

/** After a completed block, the focus categories move one step up. */
export function advanceLadderAfterBlock(ladder: Ladder, categories: WorkoutCategory[]): Ladder {
  const next: Ladder = { ...ladder };
  for (const c of new Set(categories)) next[c] = (next[c] ?? 1) + 1;
  return next;
}

/** Compliance: how close the ride was to the plan in duration and Load (0–100). */
export function compliance(planned: { minutes: number; load: number }, actual: { minutes: number; load: number | null }): number {
  const r1 = planned.minutes > 0 ? actual.minutes / planned.minutes : 1;
  const r2 = actual.load !== null && planned.load > 0 ? actual.load / planned.load : r1;
  const miss = (Math.min(Math.abs(1 - r1), 1) + Math.min(Math.abs(1 - r2), 1)) / 2;
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - miss))));
}

// ---------- FTP (D-036) ----------

export const eftpFromBest20 = (best20: number) => Math.round(best20 * 0.95);
export const ftpFromRampTest = (best1min: number) => Math.round(best1min * 0.75);

/**
 * Suggest a new FTP when the last two estimates differ ≥ 3% in the same
 * direction. A value the Athlete rejected is not asked again for 28 days
 * unless the estimate moves ≥ 3% away from it (our rule).
 */
export function ftpSuggestion(currentFtp: number, estimates: number[], rejected?: { ftp: number; daysAgo: number } | null): number | null {
  const [a, b] = estimates.slice(-2);
  if (a === undefined || b === undefined) return null;
  const da = (a - currentFtp) / currentFtp;
  const db = (b - currentFtp) / currentFtp;
  if (!(Math.abs(da) >= 0.03 && Math.abs(db) >= 0.03 && Math.sign(da) === Math.sign(db))) return null;
  const s = Math.round((a + b) / 2);
  if (rejected && rejected.daysAgo < 28 && Math.abs(s - rejected.ftp) / rejected.ftp < 0.03) return null;
  return s;
}

// ---------- Long rides & fueling (M13) ----------

export interface LongRideProposalInput {
  today: ISODate;
  lastLongRideDay: ISODate | null;
  everyWeeks: number;
  longestRideMinutes: number;
  targetMinutes: number;
  availability: AvailabilityDay[];
  /** Season events: no Long Ride Day in a taper, on an event day or in the recovery after it. */
  events?: SeasonEvent[];
  /** Days the Athlete already declined („Nie tym razem”): never proposed again. */
  declinedDates?: ISODate[];
}

/** Proposes a Long Ride Day 7–13 days ahead on the long weekend day. */
export function proposeLongRideDay(input: LongRideProposalInput): { date: ISODate; minutes: number } | null {
  if (input.longestRideMinutes >= input.targetMinutes) return null;
  if (input.longestRideMinutes < 150) return null; // build the regular long ride first
  if (input.lastLongRideDay && daysBetween(input.lastLongRideDay, input.today) < input.everyWeeks * 7) return null;
  const weekend = input.availability.filter((d) => d.available && d.weekday >= 6).sort((a, b) => b.maxMinutes - a.maxMinutes || a.weekday - b.weekday)[0];
  if (!weekend) return null;
  for (let i = 7; i <= 13; i++) {
    const date = addDays(input.today, i);
    if (weekday(date) === weekend.weekday) {
      if (inEventWindow(date, input.events ?? []) || input.declinedDates?.includes(date)) return null;
      const minutes = Math.min(input.targetMinutes, Math.round((input.longestRideMinutes + 60) / 15) * 15);
      return { date, minutes: Math.max(minutes, input.longestRideMinutes + 45) };
    }
  }
  return null;
}

export interface Fueling {
  carbsPerHour: number;
  fluidLow: number;
  fluidHigh: number;
  sodiumLow: number;
  sodiumHigh: number;
}

/**
 * Rides > 90 min: 60 g carbs/h; > 3 h: +10 g/h per comfortable long ride, max 90 (gut training).
 * Our rule from mainstream sports-nutrition guidance (R8-15).
 */
export function fueling(minutes: number, gutLevel = 0): Fueling | null {
  if (minutes <= 90) return null;
  const carbs = minutes > 180 ? Math.min(90, 60 + 10 * gutLevel) : 60;
  return { carbsPerHour: carbs, fluidLow: 500, fluidHigh: 750, sodiumLow: 300, sodiumHigh: 600 };
}
