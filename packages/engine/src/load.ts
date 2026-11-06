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
 * `loads` maps date → Load; the same Load feeds Fitness and Fatigue, so a
 * steady routine settles at Form 0 (other sports are weighted before, D-069).
 */
/**
 * Form in % is measured against Fitness, but never against less than 40
 * (D-070). With a short history (Fitness 18) an ordinary week (Form −9)
 * would read −68% — "high risk" — although −9 is a normal training value.
 * The % scale exists to scale Coggan's absolute zones for fit riders; at
 * low Fitness the absolute value is the better guide (our rule).
 */
export const FORM_PCT_FLOOR = 40;

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
    const formPct = fitness >= 15 ? form / Math.max(fitness, FORM_PCT_FLOOR) : null;
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

export interface AcwrResult {
  date: ISODate;
  acute: number;
  chronic: number;
  acwr: number | null;
  risk: "under" | "optimal" | "caution" | "danger" | "insufficient_data";
}

/**
 * Acute:Chronic Workload Ratio (Gabbett 2016, Hulin 2014, Soligard 2016).
 * Acute = rolling 7-day average daily load.
 * Chronic = rolling 28-day average daily load (chronic baseline).
 * Ratio 0.8–1.34: optimal ('sweet spot', low injury/overreaching risk).
 * Ratio 1.35–1.49: caution (elevated fatigue accumulation).
 * Ratio >= 1.50: danger (overreaching, high injury/maladaptation risk).
 */
export function computeAcwr(loads: Map<ISODate, number>, date: ISODate): AcwrResult {
  let acuteSum = 0;
  for (let i = 1; i <= 7; i++) {
    acuteSum += loads.get(addDays(date, -i)) ?? 0;
  }
  const acute = acuteSum / 7;

  let chronicSum = 0;
  let recordedDays = 0;
  for (let i = 1; i <= 28; i++) {
    const l = loads.get(addDays(date, -i));
    if (l !== undefined) {
      chronicSum += l;
      recordedDays++;
    }
  }
  const chronic = recordedDays > 0 ? chronicSum / Math.max(recordedDays, 14) : 0;

  if (recordedDays < 7 || chronic < 10) {
    return { date, acute: Math.round(acute), chronic: Math.round(chronic), acwr: null, risk: "insufficient_data" };
  }

  const acwr = Math.round((acute / chronic) * 100) / 100;
  let risk: AcwrResult["risk"] = "optimal";
  if (acwr >= 1.5) risk = "danger";
  else if (acwr >= 1.35) risk = "caution";
  else if (acwr < 0.8) risk = "under";

  return {
    date,
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    acwr,
    risk,
  };
}

