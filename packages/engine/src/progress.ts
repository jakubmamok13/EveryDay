import { addDays, daysBetween, weekday, type AvailabilityDay, type Feel, type ISODate, type WorkoutCategory } from "@everyday/shared";
import type { Ladder } from "./planner";

// Progression from ride feedback (M4.6), FTP suggestions (M12), compliance.

export interface RatedRide {
  date: ISODate;
  category: WorkoutCategory;
  compliancePct: number | null;
  feel: Feel | null;
}

const LADDER_CATEGORIES: WorkoutCategory[] = ["tempo", "sweet_spot", "threshold", "vo2max", "anaerobic", "long_ride"];

/**
 * +1 step after two "too easy" rides in a row (compliance ≥ 90%),
 * −1 step after "too hard" or compliance < 80% (our rule).
 */
export function progressLadder(ladder: Ladder, rides: RatedRide[]): { ladder: Ladder; changes: { category: WorkoutCategory; delta: number }[] } {
  const next: Ladder = { ...ladder };
  const changes: { category: WorkoutCategory; delta: number }[] = [];
  for (const cat of LADDER_CATEGORIES) {
    const recent = rides.filter((r) => r.category === cat).sort((a, b) => (a.date < b.date ? 1 : -1));
    const last = recent[0];
    if (!last) continue;
    const prev = recent[1];
    let delta = 0;
    if (last.feel === "too_hard" || (last.compliancePct !== null && last.compliancePct < 80)) delta = -1;
    else if (
      last.feel === "too_easy" && prev?.feel === "too_easy" &&
      (last.compliancePct ?? 100) >= 90 && (prev.compliancePct ?? 100) >= 90
    ) delta = 1;
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

/** Suggest a new FTP when the last two estimates differ ≥ 3% in the same direction. */
export function ftpSuggestion(currentFtp: number, estimates: number[]): number | null {
  const [a, b] = estimates.slice(-2);
  if (a === undefined || b === undefined) return null;
  const da = (a - currentFtp) / currentFtp;
  const db = (b - currentFtp) / currentFtp;
  if (Math.abs(da) >= 0.03 && Math.abs(db) >= 0.03 && Math.sign(da) === Math.sign(db)) return Math.round((a + b) / 2);
  return null;
}

// ---------- Long rides & fueling (M13) ----------

export interface LongRideProposalInput {
  today: ISODate;
  lastLongRideDay: ISODate | null;
  everyWeeks: number;
  longestRideMinutes: number;
  targetMinutes: number;
  availability: AvailabilityDay[];
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
