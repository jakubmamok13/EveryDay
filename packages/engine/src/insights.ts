import { addDays, daysBetween, weekday, type Feel, type ISODate, type PlannedDay, type Readiness, type ScaledWorkout, type WorkoutCategory, type WorkoutDef } from "@everyday/shared";
import { performanceSeries } from "./load";
import { findWorkout } from "./planner";
import { scaleWorkout } from "./workouts";

// Features chosen after the market research (docs/10, D-049 … D-063).
// Every threshold here is *our rule*, set from the cited research and tuned
// with the athlete's data after the Learning Period.

// ---------- Form projection (A1, A4, C3) ----------

export interface LoadState {
  /** End-of-day values of the day before `from`. */
  fitness: number;
  fatigue: number;
}

/** Morning Form (% of Fitness) on `target`, given daily loads from `from`. */
export function projectFormPct(start: LoadState, loads: Map<ISODate, number>, from: ISODate, target: ISODate): number | null {
  if (target < from) return null;
  const s = performanceSeries(loads, from, target, start);
  const day = s[s.length - 1]!;
  return day.formPct;
}

export function projectState(start: LoadState, loads: Map<ISODate, number>, from: ISODate, target: ISODate) {
  const s = performanceSeries(loads, from, target, start);
  return s[s.length - 1]!;
}

// ---------- A1: green light for an extra ride on a rest day ----------

export interface BonusInput {
  date: ISODate;
  readiness: Readiness | null;
  /** Feeling button of today's check-in (D-044), if any. */
  feeling: string | null;
  formPct: number | null;
  /** End of yesterday. */
  start: LoadState;
  /** Load already ridden today. */
  todayLoad: number;
  /** Planned days from tomorrow on (≥ 7 days). */
  ahead: PlannedDay[];
  /** Load of this week (Mon–yesterday, done) + planned rest of the week. */
  weekLoad: number;
  weekCap: number;
  /** Days of this week with no training at all (excluding today). */
  freeDaysLeft: number;
  bonusesThisWeek: number;
  library: WorkoutDef[];
}

export interface BonusOption {
  workout: ScaledWorkout;
  impact: { date: ISODate; name: string; formBefore: number | null; formAfter: number | null } | null;
}

export interface BonusOffer {
  eligible: boolean;
  /** Why yes / why not, in Polish. */
  reasons: string[];
  options: BonusOption[];
}

const pct = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`);

/**
 * Extra session only when it cannot hurt the next Key Workout (02 M5.6, D-049):
 * green readiness, good feeling, Form ≥ −10% (≥ −20% for Z2), the weekly ramp
 * cap, ≥ 1 free day left, at most 2 extras a week; before a Key Workout
 * tomorrow only Z1/Z2 ≤ 75 min (Seiler 2007: < 120 min below VT1 barely
 * disturbs autonomic balance); nothing moderate < 48 h before a hard day
 * (Stanley 2013); simulated Form on the next key day stays ≥ −25%.
 */
export function bonusOffer(input: BonusInput): BonusOffer {
  const r = input.readiness;
  const no = (why: string): BonusOffer => ({ eligible: false, reasons: [why], options: [] });
  if (!r) return no("brak oceny gotowości na dziś");
  if (r.overrides.length) return no("aktywny ból, choroba albo wyczerpanie");
  if (r.effective !== "green") return no("gotowość nie jest zielona");
  if (input.feeling && !["great", "good"].includes(input.feeling)) return no("samopoczucie poniżej „Dobrze”");
  if (input.bonusesThisWeek >= 2) return no("w tym tygodniu były już 2 dodatkowe jazdy");
  if (input.freeDaysLeft < 1) return no("w tygodniu nie zostałby żaden dzień wolny");
  const form = input.formPct;
  if (form !== null && form < -0.2) return no(`Forma ${pct(form)} — za duże zmęczenie`);

  const nextKey = input.ahead.filter((d) => d.date > input.date && (d.isKey || d.workout.intensity === "hard")).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const daysToKey = nextKey ? daysBetween(input.date, nextKey.date) : 99;
  const plannedLoads = new Map<ISODate, number>();
  for (const d of input.ahead) plannedLoads.set(d.date, (plannedLoads.get(d.date) ?? 0) + d.workout.load);
  const formOnKey = (extra: number) => {
    if (!nextKey) return null;
    const loads = new Map(plannedLoads);
    loads.set(input.date, input.todayLoad + extra);
    return projectFormPct(input.start, loads, input.date, nextKey.date);
  };
  const before = formOnKey(0);

  const candidates: ScaledWorkout[] = [];
  const z2 = (m: number) => scaleWorkout(findWorkout(input.library, "endurance-z2"), { targetMinutes: m });
  const easyOnly = !input.feeling || daysToKey <= 1 || (form !== null && form < -0.1);
  const z2Minutes = daysToKey <= 1 ? [45, 60, 75] : [45, 60, 90, 120];
  for (const m of z2Minutes) candidates.push(z2(m));
  if (!easyOnly && daysToKey >= 3 && input.feeling === "great") candidates.push(scaleWorkout(findWorkout(input.library, "tempo-2x15")));
  candidates.unshift(scaleWorkout(findWorkout(input.library, "recovery-30")));

  const options: BonusOption[] = [];
  for (const w of candidates) {
    if (input.weekLoad + w.load > input.weekCap) continue;
    const after = formOnKey(w.load);
    if (after !== null && after < -0.25) continue;
    options.push({ workout: w, impact: nextKey ? { date: nextKey.date, name: nextKey.workout.name, formBefore: before, formAfter: after } : null });
  }
  if (!options.length) return no("dodatkowa jazda przekroczyłaby bezpieczny wzrost obciążenia w tym tygodniu");
  // Recovery spin + the two most useful longer options.
  const picked = [options[0]!, ...options.slice(1).filter((o) => o.workout.category !== "recovery").slice(-2)];
  const reasons = [
    `gotowość zielona${input.feeling ? `, samopoczucie „${input.feeling === "great" ? "W pełni sił" : "Dobrze"}”` : ""}, Forma ${pct(form)}`,
    nextKey ? `najbliższy kluczowy trening za ${daysToKey} ${daysToKey === 1 ? "dzień" : "dni"} — ${daysToKey <= 1 ? "tylko spokojnie, do 75 min" : "jest czas na regenerację"}` : "w najbliższym tygodniu brak kluczowych treningów",
    `tydzień zostaje w limicie bezpiecznego wzrostu Kondycji`,
  ];
  return { eligible: true, reasons, options: picked.filter((o, i, a) => a.findIndex((x) => x.workout.slug === o.workout.slug && x.workout.minutes === o.workout.minutes) === i) };
}

// ---------- A4: warning for tomorrow ----------

export interface TomorrowOutlook {
  level: "ok" | "yellow" | "red";
  formPct: number | null;
  text: string;
}

/**
 * Tomorrow's morning Form after today's load (done, or planned if not yet
 * ridden). A hard / key day tomorrow with Form < −30% → yellow, < −45% → red
 * (the Readiness Form limits, 02 M5.2) — the same idea as TrainerRoad's
 * Red Light Green Light, but from Load only.
 */
export function tomorrowOutlook(start: LoadState, date: ISODate, todayLoad: number, tomorrow: PlannedDay | null): TomorrowOutlook {
  const loads = new Map([[date, todayLoad]]);
  const f = projectFormPct(start, loads, date, addDays(date, 1));
  if (!tomorrow || (tomorrow.workout.intensity !== "hard" && !tomorrow.isKey)) return { level: "ok", formPct: f, text: "" };
  if (f === null || f >= -0.3) return { level: "ok", formPct: f, text: "" };
  const level = f < -0.45 ? "red" : "yellow";
  const now = projectFormPct(start, loads, date, date);
  const limit = level === "red" ? "poniżej −45%" : "poniżej −30%";
  const why = todayLoad > 0
    ? `Po dzisiejszym treningu (obciążenie ${Math.round(todayLoad)}) Forma jutro rano wyniesie ok. ${pct(f)}${now !== null ? ` (dziś ${pct(now)})` : ""} — ${limit}.`
    : `Dziś bez treningu, więc Forma rośnie${now !== null ? ` z ${pct(now)}` : ""} do ok. ${pct(f)} jutro rano — ale to wciąż ${limit}: zmęczenie z ostatnich dni jeszcze nie zeszło.`;
  return {
    level,
    formPct: f,
    text: `${why} „${tomorrow.workout.name}” będzie prawdopodobnie ${level === "red" ? "za ciężki" : "bardzo ciężki"}.`,
  };
}

// ---------- B1: visible progression levels ----------

export const LEVEL_CATEGORIES: WorkoutCategory[] = ["sweet_spot", "threshold", "vo2max", "tempo", "anaerobic", "long_ride"];

export function maxLevel(library: WorkoutDef[], cat: WorkoutCategory): number {
  return Math.max(1, ...library.filter((w) => w.category === cat).map((w) => w.level));
}

/** How hard a workout is for this athlete: its level vs the athlete's level in that category. */
export function challenge(workoutLevel: number, athleteLevel: number): { key: "easy" | "achievable" | "stretch" | "breakthrough"; label: string } {
  const d = workoutLevel - athleteLevel;
  if (d <= -1) return { key: "easy", label: "łatwy dla Ciebie" };
  if (d === 0) return { key: "achievable", label: "osiągalny" };
  if (d === 1) return { key: "stretch", label: "ambitny" };
  return { key: "breakthrough", label: "bardzo ambitny" };
}

// ---------- B2: 5-step rating ----------

export type Effort = "easy" | "moderate" | "hard" | "very_hard" | "all_out";
export type Completed = "yes" | "partial" | "no";

export const EFFORT_LABEL: Record<Effort, string> = {
  easy: "Łatwo", moderate: "Umiarkowanie", hard: "Ciężko", very_hard: "Bardzo ciężko", all_out: "Na maksa",
};
/** Borg CR-10 style RPE for session-RPE Load (Foster 2001). */
export const EFFORT_RPE: Record<Effort, number> = { easy: 3, moderate: 5, hard: 7, very_hard: 8, all_out: 10 };

/** Progression score: + means room to progress, − means too much (TrainerRoad-style survey). */
export function effortScore(effort: Effort | null, completed: Completed | null, feel: Feel | null): number {
  if (completed === "no") return -1;
  if (effort) return { easy: 1, moderate: 0.5, hard: 0, very_hard: -0.5, all_out: -1 }[effort] + (completed === "partial" ? -0.5 : 0);
  return feel === "too_easy" ? 1 : feel === "too_hard" ? -1 : 0;
}

export function effortToFeel(effort: Effort, completed: Completed): Feel {
  const s = effortScore(effort, completed, null);
  return s >= 1 ? "too_easy" : s <= -1 ? "too_hard" : "just_right";
}

// ---------- B6: FTP confidence ----------

export interface FtpInsight {
  ftp: number;
  estimate: number | null;
  confidence: "high" | "medium" | "low";
  efforts: number;
  daysSinceTest: number | null;
  text: string;
  testAdvice: string | null;
}

/**
 * eFTP is only as good as the hard efforts behind it: ≥ 3 near-threshold
 * efforts (best 20 min ≥ 90% FTP or 5 min ≥ 106%) in 42 days = high, 1–2 =
 * medium, none = low. A test is worth it when confidence is low and the
 * last test is > 6 weeks old.
 */
export function ftpInsight(ftp: number, estimate: number | null, best20s: number[], best5s: number[], daysSinceTest: number | null): FtpInsight {
  const efforts = best20s.filter((p) => p >= 0.9 * ftp).length + best5s.filter((p) => p >= 1.06 * ftp).length;
  const confidence = efforts >= 3 ? "high" : efforts >= 1 ? "medium" : "low";
  const word = { high: "wysoka", medium: "średnia", low: "niska" }[confidence];
  const text = estimate
    ? `Szacunek z jazd: ${estimate} W (Twoje FTP ${ftp} W). Pewność ${word}: ${efforts} mocnych wysiłków w 6 tygodni.`
    : `Brak szacunku z jazd. Pewność ${word}: ${efforts} mocnych wysiłków w 6 tygodni.`;
  let testAdvice: string | null = null;
  if (confidence === "low" && (daysSinceTest === null || daysSinceTest > 42)) {
    testAdvice = "Za mało mocnych wysiłków, żeby ocenić FTP z jazd. Zrób test rampowy w najbliższym tygodniu regeneracyjnym (plan ma go co 4 tygodnie).";
  } else if (confidence === "high") {
    testAdvice = "Test nie jest potrzebny: FTP ocenia się z Twoich treningów.";
  }
  return { ftp, estimate, confidence, efforts, daysSinceTest, text, testAdvice };
}

// ---------- B3: power profile (Coggan) ----------

export type Sex = "m" | "f";
export interface Peaks {
  p5: number | null;
  p60: number | null;
  p300: number | null;
  p1200: number | null;
}

/**
 * Coggan power profile, W/kg (Allen & Coggan, Training and Racing with a
 * Power Meter): [bottom, top] of the table for 5 s, 1 min, 5 min and FT.
 * Women's bottom values except FT are scaled from the men's table (approx.).
 */
const COGGAN: Record<Sex, Record<"p5" | "p60" | "p300" | "ft", [number, number]>> = {
  m: { p5: [10.17, 24.04], p60: [5.64, 11.5], p300: [2.33, 7.6], ft: [1.86, 6.4] },
  f: { p5: [8.22, 19.42], p60: [4.56, 9.29], p300: [2.07, 6.74], ft: [1.5, 5.69] },
};

const PROFILE_LABEL = { p5: "Sprint (5 s)", p60: "Moc beztlenowa (1 min)", p300: "VO2max (5 min)", ft: "Próg (FTP)" } as const;
type ProfileKey = keyof typeof PROFILE_LABEL;

export interface PowerProfile {
  rows: { key: ProfileKey; label: string; watts: number; wkg: number; score: number }[];
  riderType: string;
  weakness: ProfileKey | null;
  strength: ProfileKey | null;
  /** Workout category that trains the weakness (aerobic weaknesses only steer the plan). */
  focusCategory: WorkoutCategory | null;
  text: string;
}

/** Rider type from the shape of the profile (relative position in the table, 0–100). */
export function powerProfile(peaks: Peaks, ftp: number, weightKg: number | null, sex: Sex = "m"): PowerProfile | null {
  if (!weightKg || !peaks.p5 || !peaks.p60 || !peaks.p300) return null;
  const vals: Record<ProfileKey, number> = { p5: peaks.p5, p60: peaks.p60, p300: peaks.p300, ft: Math.max(ftp, peaks.p1200 ? peaks.p1200 * 0.95 : 0) };
  const rows = (Object.keys(PROFILE_LABEL) as ProfileKey[]).map((key) => {
    const wkg = vals[key] / weightKg;
    const [lo, hi] = COGGAN[sex][key];
    const score = Math.round(Math.max(0, Math.min(100, ((wkg - lo) / (hi - lo)) * 100)));
    return { key, label: PROFILE_LABEL[key], watts: Math.round(vals[key]), wkg: Math.round(wkg * 100) / 100, score };
  });
  const by = Object.fromEntries(rows.map((r) => [r.key, r.score])) as Record<ProfileKey, number>;
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const spread = sorted[0]!.score - sorted[sorted.length - 1]!.score;
  let riderType = "Wszechstronny";
  if (spread >= 10) {
    const top = sorted[0]!.key;
    if (top === "p5") riderType = "Sprinter";
    else if (top === "p60") riderType = by.p5 >= by.ft ? "Sprinter / puncher" : "Puncher";
    else if (top === "p300") riderType = "Wspinacz / puncher";
    else riderType = "Czasowiec / wspinacz";
  }
  const weak = spread >= 10 ? sorted[sorted.length - 1]!.key : null;
  const strong = spread >= 10 ? sorted[0]!.key : null;
  const focusCategory: WorkoutCategory | null = weak === "p300" ? "vo2max" : weak === "ft" ? "threshold" : null;
  const text = weak
    ? `Najsłabiej: ${PROFILE_LABEL[weak].toLowerCase()} (${by[weak]}/100). ${focusCategory ? `Plan dokłada akcent: ${focusCategory === "vo2max" ? "VO2max" : "próg"}.` : "Sprint i moc beztlenowa nie są celem planu FTP — to informacja."}`
    : "Profil wyrównany — plan zostaje bez dodatkowego akcentu.";
  return { rows, riderType, weakness: weak, strength: strong, focusCategory, text };
}

/** Best average power over each window (1 Hz samples). */
export function peaksFromWatts(watts: number[]): Peaks {
  const best = (win: number): number | null => {
    if (watts.length < win) return null;
    let sum = 0;
    for (let i = 0; i < win; i++) sum += watts[i] ?? 0;
    let max = sum;
    for (let i = win; i < watts.length; i++) {
      sum += (watts[i] ?? 0) - (watts[i - win] ?? 0);
      if (sum > max) max = sum;
    }
    return Math.round(max / win);
  };
  return { p5: best(5), p60: best(60), p300: best(300), p1200: best(1200) };
}

// ---------- B5: durability ----------

export interface RideDurability {
  /** Total work, kJ/kg. */
  kjPerKg: number;
  /** Best 5 / 20 min power after 20 and 30 kJ/kg of work (null if not reached). */
  after20: { p300: number | null; p1200: number | null };
  after30: { p300: number | null; p1200: number | null };
}

/** Durability inputs from one ride's power stream (Maunder et al. 2021). */
export function durabilityFromWatts(watts: number[], weightKg: number): RideDurability {
  const cum: number[] = [];
  let kj = 0;
  for (const w of watts) {
    kj += (w ?? 0) / 1000;
    cum.push(kj / weightKg);
  }
  const after = (threshold: number) => {
    const i = cum.findIndex((c) => c >= threshold);
    if (i < 0) return { p300: null, p1200: null };
    const rest = watts.slice(i);
    const p = peaksFromWatts(rest);
    return { p300: p.p300, p1200: p.p1200 };
  };
  return { kjPerKg: Math.round(kj / weightKg * 10) / 10, after20: after(20), after30: after(30) };
}

export interface DurabilitySummary {
  /** % of fresh best power kept after 20 kJ/kg (5 and 20 min). */
  keep300: number | null;
  keep1200: number | null;
  rides: number;
  word: string;
  text: string;
}

/**
 * Fresh best = best 5 / 20 min of the period; fatigued best = best after
 * 20 kJ/kg. Better riders keep ~96% of 20-min power after 50 kJ/kg, weaker
 * ~92% (Maunder 2021 review data). Our bands for 20 kJ/kg: ≥ 95% very good,
 * 90–95% good, 85–90% fair, < 85% to work on.
 */
export function durabilitySummary(fresh: { p300: number | null; p1200: number | null }, rides: RideDurability[]): DurabilitySummary {
  const long = rides.filter((r) => r.after20.p300 !== null || r.after20.p1200 !== null);
  if (!long.length) {
    return { keep300: null, keep1200: null, rides: 0, word: "brak danych", text: "Potrzebne długie jazdy z pomiarem mocy (≥ 20 kJ/kg, ok. 2,5–3 h Z2). Bez miernika mocy na zewnątrz policzę to z dłuższych jazd na trenażerze." };
  }
  const best = (k: "p300" | "p1200") => Math.max(0, ...long.map((r) => r.after20[k] ?? 0));
  // A late effort above the fresh best means the fresh value is low: no measurable loss.
  const keep = (f: number | null, k: "p300" | "p1200") => (f && best(k) ? Math.min(100, Math.round((best(k) / f) * 100)) : null);
  const keep300 = keep(fresh.p300, "p300");
  const keep1200 = keep(fresh.p1200, "p1200");
  const main = keep1200 ?? keep300 ?? 0;
  const word = main >= 95 ? "bardzo dobra" : main >= 90 ? "dobra" : main >= 85 ? "średnia" : "do poprawy";
  const text = `Po 20 kJ/kg pracy utrzymujesz ${keep1200 !== null ? `${keep1200}% mocy 20-min` : ""}${keep1200 !== null && keep300 !== null ? " i " : ""}${keep300 !== null ? `${keep300}% mocy 5-min` : ""} (ze ${long.length} długich jazd). Odporność na zmęczenie: ${word}. Buduje ją regularna długa jazda i akcenty pod koniec długich jazd.`;
  return { keep300, keep1200, rides: long.length, word, text };
}

// ---------- D1: carbohydrate for the day (ACSM 2016) ----------

export interface CarbAdvice {
  level: "low" | "moderate" | "high" | "very_high";
  word: string;
  gPerKg: [number, number];
  grams: [number, number] | null;
  text: string;
}

/**
 * Daily carbohydrate by training load — Thomas, Erdman & Burke 2016 (ACSM /
 * AND / DC joint position): light 3–5 g/kg, moderate (~1 h/day) 5–7, high
 * (1–3 h/day) 6–10, very high (> 4–5 h/day) 8–12. "Fuel for the work
 * required": tomorrow's long or hard ride raises today's need too. Not a
 * diet: no weight-loss advice (R8-15).
 */
export function carbAdvice(weightKg: number | null, today: ScaledWorkout | null, tomorrow: ScaledWorkout | null): CarbAdvice {
  const lvl = (w: ScaledWorkout | null): number => {
    if (!w || w.category === "recovery") return 0;
    if (w.minutes > 240) return 3;
    if (w.minutes > 75 || (w.intensity === "hard" && w.minutes >= 60)) return 2;
    return 1;
  };
  const t = lvl(today);
  const n = lvl(tomorrow);
  // Tomorrow's long or hard ride raises today's need by one step at most.
  const level = (["low", "moderate", "high", "very_high"] as const)[Math.max(t, n >= 2 ? n - 1 : 0)]!;
  const table = { low: [3, 5], moderate: [5, 7], high: [6, 10], very_high: [8, 12] } as const;
  const word = { low: "mało", moderate: "średnio", high: "dużo", very_high: "bardzo dużo" }[level];
  const g = table[level];
  const grams: [number, number] | null = weightKg ? [Math.round(g[0] * weightKg / 10) * 10, Math.round(g[1] * weightKg / 10) * 10] : null;
  const why = t >= n ? (today ? `dziś ${today.name.toLowerCase()}` : "dziś odpoczynek") : `jutro ${tomorrow!.name.toLowerCase()} — uzupełnij zapasy dzień wcześniej`;
  return {
    level,
    word,
    gPerKg: [g[0], g[1]],
    grams,
    text: `Węglowodany dziś: ${word} (${g[0]}–${g[1]} g/kg${grams ? ` ≈ ${grams[0]}–${grams[1]} g` : ""}) — ${why}.`,
  };
}

// ---------- C4: return after a break ----------

/**
 * Detraining (Coyle 1984: VO2max −7% in 21 days; Mujika & Padilla 2000):
 * 7–13 days off → ladder −1; 14–27 → −2 and FTP −3%; ≥ 28 → −3 and FTP −6%.
 * The first week back is ~60% of the usual volume and the first 3 days easy.
 */
export function returnPlan(daysOff: number): { ladderDrop: number; ftpFactor: number; volumeFactor: number; easyDays: number } | null {
  if (daysOff < 7) return null;
  if (daysOff < 14) return { ladderDrop: 1, ftpFactor: 1, volumeFactor: 0.7, easyDays: 2 };
  if (daysOff < 28) return { ladderDrop: 2, ftpFactor: 0.97, volumeFactor: 0.6, easyDays: 3 };
  return { ladderDrop: 3, ftpFactor: 0.94, volumeFactor: 0.5, easyDays: 3 };
}

/** Monday after `d`. */
export const nextMonday = (d: ISODate): ISODate => addDays(d, 8 - weekday(d));
