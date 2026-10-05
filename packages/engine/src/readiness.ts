import { SPORT_WEIGHTS, type SportGroup } from "./sports";
import { addDays, type ChatNote, type CheckIn, type ISODate, type InputRating, type Readiness, type ReadinessInput, type WellnessDay } from "@everyday/shared";

// Readiness score (02 M5.2). Thresholds are *our rule*, calibrated after the Learning Period.

export interface ReadinessContext {
  date: ISODate;
  /** Wellness history up to and including `date`. */
  wellness: WellnessDay[];
  checkIn?: CheckIn | null;
  /** Morning Form as a fraction of Fitness (−0.3 = −30%). */
  formPct?: number | null;
  /** Readiness shows "learning" until this date (exclusive). */
  learningUntil?: ISODate | null;
  activeNotes?: ChatNote[];
  /**
   * Non-cycling sessions of the previous 2 days (D-047). Undefined = the
   * Athlete does not count other sports; the input is then left out.
   */
  recentOther?: { date: ISODate; group: SportGroup; load: number }[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

function series(wellness: WellnessDay[], key: keyof WellnessDay, from: ISODate, to: ISODate): number[] {
  return wellness
    .filter((w) => w.date >= from && w.date <= to && typeof w[key] === "number")
    .map((w) => w[key] as number);
}

/**
 * HRV: today vs the personal normal band (60-day mean − 1 SD, at least 3%).
 * Caution = tonight below the band; bad = 7-day average below the band
 * with at least 3 low nights (one bad night alone is not "bad"). Our rule.
 */
export function rateHrv(wellness: WellnessDay[], date: ISODate): ReadinessInput {
  const today = wellness.find((w) => w.date === date)?.hrv;
  if (typeof today !== "number") return { key: "hrv", rating: "missing" };
  const hist = series(wellness, "hrv", addDays(date, -60), addDays(date, -1));
  if (hist.length < 14) return { key: "hrv", rating: "missing", value: today, detail: "baseline" };
  const m = mean(hist);
  const low = m - Math.max(sd(hist), m * 0.03);
  const last7 = series(wellness, "hrv", addDays(date, -6), date);
  const lowNights = last7.filter((v) => v < low).length;
  let rating: InputRating = "ok";
  if (mean(last7) < low && lowNights >= 3) rating = "bad";
  else if (today < low) rating = "caution";
  return { key: "hrv", rating, value: today, baseline: Math.round(m) };
}

export function rateRestingHr(wellness: WellnessDay[], date: ISODate): ReadinessInput {
  const today = wellness.find((w) => w.date === date)?.restingHr;
  if (typeof today !== "number") return { key: "rhr", rating: "missing" };
  const hist = series(wellness, "restingHr", addDays(date, -30), addDays(date, -1));
  if (hist.length < 7) return { key: "rhr", rating: "missing", value: today, detail: "baseline" };
  const m = mean(hist);
  const diff = today - m;
  const rating: InputRating = diff >= 8 ? "bad" : diff >= 5 ? "caution" : "ok";
  return { key: "rhr", rating, value: today, baseline: Math.round(m) };
}

export function rateSleep(w: WellnessDay | undefined): ReadinessInput {
  const secs = w?.sleepSeconds;
  if (typeof secs !== "number") return { key: "sleep", rating: "missing" };
  const h = secs / 3600;
  const score = w?.sleepScore;
  let rating: InputRating = "ok";
  if (h < 5) rating = "bad";
  else if (h < 6 || (typeof score === "number" && score < 60)) rating = "caution";
  return { key: "sleep", rating, value: Math.round(h * 10) / 10 };
}

export function rateBodyBattery(w: WellnessDay | undefined): ReadinessInput {
  const bb = w?.bodyBatteryMax;
  if (typeof bb !== "number") return { key: "body_battery", rating: "missing" };
  return { key: "body_battery", rating: bb < 30 ? "bad" : bb < 50 ? "caution" : "ok", value: bb };
}

export function rateGarminReadiness(w: WellnessDay | undefined): ReadinessInput {
  const r = w?.garminReadiness;
  if (typeof r !== "number") return { key: "garmin_readiness", rating: "missing" };
  return { key: "garmin_readiness", rating: r < 25 ? "bad" : r < 50 ? "caution" : "ok", value: r };
}

export function rateForm(formPct: number | null | undefined): ReadinessInput {
  if (typeof formPct !== "number") return { key: "form", rating: "missing" };
  const pct = Math.round(formPct * 100);
  return { key: "form", rating: formPct < -0.45 ? "bad" : formPct < -0.3 ? "caution" : "ok", value: pct };
}

export function rateCheckIn(c: CheckIn | null | undefined): ReadinessInput {
  if (!c) return { key: "check_in", rating: "missing" };
  const low = (["legs", "sleepQuality", "motivation"] as const).filter((k) => c[k] <= 2);
  // Our rule (D-041): legs = 1, or two or more low answers, is a strong signal.
  // One-tap check-in (D-044): the button pressed explains the rating best.
  const feeling = c.feeling ? `feeling:${c.feeling}` : null;
  if (c.legs <= 1 || low.length >= 2) return { key: "check_in", rating: "bad", detail: feeling ?? (low.join(",") || "legs") };
  const detail = feeling ?? (low.length ? low.join(",") : null);
  return { key: "check_in", rating: low.length ? "caution" : "ok", ...(detail ? { detail } : {}) };
}

/**
 * Leg-heavy sessions in other sports (running: eccentric muscle damage;
 * strength: lower HRV and performance up to 48 h) hurt the next bike
 * session more than their Load shows (Millet 2009; Wilson 2012). Our rule:
 * caution after Load ≥ 40 yesterday or ≥ 80 two days ago; bad after ≥ 100
 * yesterday. Other sports only add their Load to Fatigue.
 */
export function rateOtherSport(recent: ReadinessContext["recentOther"], date: ISODate): ReadinessInput | null {
  if (!recent) return null;
  const legs = recent.filter((s) => SPORT_WEIGHTS[s.group].legs);
  const sum = (d: ISODate) => legs.filter((s) => s.date === d).reduce((a, s) => a + s.load, 0);
  const y = sum(addDays(date, -1));
  const y2 = sum(addDays(date, -2));
  const main = legs.filter((s) => s.date >= addDays(date, -2)).sort((a, b) => b.load - a.load)[0];
  if (!main) return { key: "other_sport", rating: "ok", detail: "none" };
  const rating: InputRating = y >= 100 ? "bad" : y >= 40 || y2 >= 80 ? "caution" : "ok";
  return { key: "other_sport", rating, value: Math.round(main.date === addDays(date, -1) ? y : y2), detail: `${main.group}:${main.date === addDays(date, -1) ? 1 : 2}` };
}

function noteActive(notes: ChatNote[] | undefined, kind: ChatNote["kind"], date: ISODate): boolean {
  return (notes ?? []).some((n) => n.kind === kind && n.startDate <= date && n.endDate >= date);
}

export function computeReadiness(ctx: ReadinessContext): Readiness {
  const today = ctx.wellness.find((w) => w.date === ctx.date);
  const learning = !!ctx.learningUntil && ctx.date < ctx.learningUntil;
  const inputs: ReadinessInput[] = [
    learning ? { key: "hrv", rating: "missing", detail: "learning" } : rateHrv(ctx.wellness, ctx.date),
    learning ? { key: "rhr", rating: "missing", detail: "learning" } : rateRestingHr(ctx.wellness, ctx.date),
    rateSleep(today),
    rateBodyBattery(today),
    rateGarminReadiness(today),
    rateForm(ctx.formPct),
    rateCheckIn(ctx.checkIn),
  ];
  const other = rateOtherSport(ctx.recentOther, ctx.date);
  if (other) inputs.push(other);
  const bads = inputs.filter((i) => i.rating === "bad").length;
  const cautions = inputs.filter((i) => i.rating === "caution").length;
  const score = Math.max(0, Math.min(100, 100 - 10 * cautions - 25 * bads));

  const overrides: Readiness["overrides"] = [];
  if (ctx.checkIn?.sick || noteActive(ctx.activeNotes, "illness", ctx.date)) overrides.push("sick");
  if (ctx.checkIn?.pain || noteActive(ctx.activeNotes, "injury", ctx.date)) overrides.push("pain");
  if (ctx.checkIn?.exhausted) overrides.push("exhausted");

  let effective: Readiness["effective"] = "green";
  if (overrides.includes("sick") || overrides.includes("exhausted") || bads >= 2) effective = "red";
  else if (bads === 1 || cautions >= 2) effective = "yellow";

  const first = inputs.find((i) => i.rating === "bad") ?? inputs.find((i) => i.rating === "caution");
  const mainReason = overrides.includes("sick")
    ? "sick"
    : overrides.includes("exhausted")
      ? "exhausted"
      : overrides.includes("pain") && effective === "green"
      ? "pain"
      : first
        ? `${first.key}:${first.rating}`
        : inputs.every((i) => i.rating === "missing")
          ? "no_data"
          : "all_ok";

  return {
    date: ctx.date,
    score: overrides.includes("sick") || overrides.includes("exhausted") ? Math.min(score, 20) : score,
    state: learning ? "learning" : effective,
    effective,
    inputs,
    overrides,
    mainReason,
  };
}
