import { addDays, type ISODate } from "@everyday/shared";

/** Coggan Load (TSS-equivalent) from weighted (normalized) power. */
export function powerLoad(seconds: number, weightedPower: number, ftp: number): number {
  if (ftp <= 0 || seconds <= 0) return 0;
  const intensity = weightedPower / ftp;
  return (seconds * weightedPower * intensity) / (ftp * 3600) * 100;
}

const FITNESS_DAYS = 42;
const FATIGUE_DAYS = 7;
const kFit = 1 - Math.exp(-1 / FITNESS_DAYS);
const kFat = 1 - Math.exp(-1 / FATIGUE_DAYS);

export interface DayPerformance {
  date: ISODate;
  load: number;
  /** End-of-day values. */
  fitness: number;
  fatigue: number;
  /** Morning Form for this date = yesterday's fitness − fatigue. */
  form: number;
  formPct: number | null;
}

/**
 * Fitness / Fatigue / Form series (Performance Manager, exponentially weighted).
 * `loads` maps date → total Load of master activities that day.
 */
export function performanceSeries(
  loads: Map<ISODate, number>,
  from: ISODate,
  to: ISODate,
  start: { fitness: number; fatigue: number } = { fitness: 0, fatigue: 0 },
): DayPerformance[] {
  const out: DayPerformance[] = [];
  let fitness = start.fitness;
  let fatigue = start.fatigue;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const form = fitness - fatigue;
    const formPct = fitness >= 15 ? form / fitness : null;
    const load = loads.get(d) ?? 0;
    fitness += (load - fitness) * kFit;
    fatigue += (load - fatigue) * kFat;
    out.push({ date: d, load, fitness, fatigue, form, formPct });
  }
  return out;
}

/** Approximate Fitness after a week at a steady daily load (used for ramp planning). */
export function fitnessAfterWeek(fitness: number, weekLoad: number): number {
  const daily = weekLoad / 7;
  let f = fitness;
  for (let i = 0; i < 7; i++) f += (daily - f) * kFit;
  return f;
}

/** Highest weekly Load that keeps the Fitness rise at or below `rampPerWeek`. */
export function weeklyLoadCap(fitness: number, rampPerWeek = 5): number {
  // Solve fitnessAfterWeek(fitness, L) = fitness + ramp for L.
  const decay = Math.pow(1 - kFit, 7);
  const daily = (fitness + rampPerWeek - fitness * decay) / (1 - decay);
  return Math.max(0, daily * 7);
}
