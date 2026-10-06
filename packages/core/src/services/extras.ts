import { LIBRARY } from "@everyday/library";
import { addDays, daysBetween, mondayOf, weekday, type ISODate, type Readiness, type RideMode, type ScaledWorkout } from "@everyday/shared";
import {
  bonusOffer,
  carbAdvice,
  challenge,
  ftpInsight,
  LEVEL_CATEGORIES,
  maxLevel,
  nextMonday,
  performanceSeries,
  projectState,
  returnPlan,
  scaleWorkout,
  findWorkout,
  tomorrowOutlook,
  weekPosition,
  weeklyLoadCap,
  type LoadState,
} from "@everyday/engine";
import type { App } from "../app";
import { nowIso } from "../db";
import { activeNotes, availability, checkIn, dailyState, goals, ladder, physiologyOn, plannedActiveOn, plannedBetween, setLadder, toPlannedDay, addSnapshot } from "../repo";
import { applyAction } from "./actions";
import { refreshBrief, todayView } from "./daily";
import { hitBlockStart, insertWorkout, regenerate, seasonEvents, writeCalendar } from "./plan";
import { bestPeaks, durabilityView } from "./profile";
import { countsOtherSports } from "./sync";

// Research features (docs/10, D-049 …): today's extras, levels, FTP, season.

const CAT_PL: Record<string, string> = {
  sweet_spot: "Sweet Spot", threshold: "Próg", vo2max: "VO2max", tempo: "Tempo", anaerobic: "Beztlenowe", long_ride: "Długa jazda",
};

/** End-of-day Fitness / Fatigue of the day before `date`. */
export function stateBefore(app: App, athleteId: number, date: ISODate): LoadState {
  const r = app.db.get("SELECT fitness, fatigue FROM daily_state WHERE athlete_id = ? AND date < ? AND fitness IS NOT NULL ORDER BY date DESC LIMIT 1", athleteId, date);
  return { fitness: r?.fitness ?? 0, fatigue: r?.fatigue ?? 0 };
}

/** Load that counts in Fatigue on one day (rides + other sports when counted). */
export function loadDone(app: App, athleteId: number, from: ISODate, to: ISODate): number {
  const sql = countsOtherSports(app)
    ? "SELECT SUM(load) AS l FROM activity WHERE athlete_id = ? AND is_master = 1 AND date BETWEEN ? AND ?"
    : "SELECT SUM(load) AS l FROM activity WHERE athlete_id = ? AND is_master = 1 AND sport = 'ride' AND date BETWEEN ? AND ?";
  return app.db.get<{ l: number | null }>(sql, athleteId, from, to)?.l ?? 0;
}

function readinessOn(app: App, athleteId: number, date: ISODate): Readiness | null {
  const json = dailyState(app, athleteId, date)?.readiness_json;
  return json ? JSON.parse(json) : null;
}

// ---------- A1: green light for an extra ride ----------

export function bonusView(app: App, athleteId: number) {
  const date = app.today();
  if (app.setting<{ date: string | null }>("bonusDismissed", { date: null }).date === date) return null;
  if (plannedActiveOn(app, athleteId, date) || app.db.get("SELECT 1 FROM planned_workout WHERE athlete_id = ? AND date = ? AND status = 'skipped'", athleteId, date)) return null;
  if (activeNotes(app, athleteId, date).some((n) => n.kind === "travel")) return null;
  const monday = mondayOf(date);
  const sunday = addDays(monday, 6);
  const ahead = plannedBetween(app, athleteId, addDays(date, 1), addDays(date, 8)).map(toPlannedDay);
  const weekPlanned = plannedBetween(app, athleteId, addDays(date, 1), sunday).reduce((s, r) => s + JSON.parse(r.workout_json).load, 0);
  const busy = (d: ISODate) =>
    !!app.db.get("SELECT 1 FROM activity WHERE athlete_id = ? AND is_master = 1 AND date = ?", athleteId, d) || !!plannedActiveOn(app, athleteId, d);
  let freeDaysLeft = 0;
  for (let d = monday; d <= sunday; d = addDays(d, 1)) if (d !== date && !busy(d)) freeDaysLeft++;
  const ci = checkIn(app, athleteId, date);
  const offer = bonusOffer({
    date,
    readiness: readinessOn(app, athleteId, date),
    feeling: ci?.feeling ?? null,
    formPct: dailyState(app, athleteId, date)?.form_pct ?? null,
    start: stateBefore(app, athleteId, date),
    todayLoad: loadDone(app, athleteId, date, date),
    ahead,
    weekLoad: loadDone(app, athleteId, monday, date) + weekPlanned,
    weekCap: weeklyLoadCap(stateBefore(app, athleteId, monday).fitness),
    freeDaysLeft,
    bonusesThisWeek: app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM planned_workout WHERE athlete_id = ? AND role = 'bonus' AND status IN ('planned','completed','partial') AND date BETWEEN ? AND ?", athleteId, monday, sunday)!.n,
    library: LIBRARY,
  });
  if (!offer.eligible) return null;
  return {
    reasons: offer.reasons,
    options: offer.options.map((o) => ({
      slug: o.workout.slug,
      name: o.workout.name,
      minutes: o.workout.minutes,
      load: o.workout.load,
      intensity: o.workout.intensity,
      impact: o.impact,
    })),
  };
}

export async function acceptBonus(app: App, athleteId: number, slug: string, minutes: number, rideMode: RideMode): Promise<boolean> {
  const view = bonusView(app, athleteId);
  const opt = view?.options.find((o) => o.slug === slug && o.minutes === minutes);
  if (!opt) return false;
  const def = findWorkout(LIBRARY, slug);
  const w: ScaledWorkout = def.category === "endurance" ? scaleWorkout(def, { targetMinutes: minutes }) : scaleWorkout(def);
  insertWorkout(app, athleteId, app.today(), "bonus", false, w, rideMode, "bonus", ["bonus_green_light"], `dodatkowa jazda: ${w.name}`);
  await refreshBrief(app, athleteId, app.today());
  return true;
}

// ---------- A4: tomorrow ----------

export function tomorrowView(app: App, athleteId: number) {
  const date = app.today();
  const tomorrow = addDays(date, 1);
  if (app.setting<{ date: string | null }>("tomorrowDismissed", { date: null }).date === date) return null;
  const row = plannedActiveOn(app, athleteId, tomorrow);
  if (!row || row.status !== "planned") return null;
  const done = loadDone(app, athleteId, date, date);
  const today = plannedActiveOn(app, athleteId, date);
  const todayLoad = done > 0 ? done : today && today.status === "planned" ? JSON.parse(today.workout_json).load : 0;
  const o = tomorrowOutlook(stateBefore(app, athleteId, date), date, todayLoad, toPlannedDay(row));
  if (o.level === "ok") return null;
  const dayAfter = addDays(tomorrow, 1);
  const canMove = !plannedActiveOn(app, athleteId, dayAfter) && availability(app, athleteId).days.some((d) => d.weekday === weekday(dayAfter) && d.available);
  return { level: o.level, formPct: o.formPct, text: o.text, after: done > 0, canMove, dayAfter };
}

export async function tomorrowAction(app: App, athleteId: number, action: "easier" | "move" | "dismiss"): Promise<{ ok: boolean; text: string }> {
  const date = app.today();
  const tomorrow = addDays(date, 1);
  if (action === "dismiss") {
    app.setSetting("tomorrowDismissed", { date });
    return { ok: true, text: "OK, zostawiam plan." };
  }
  const r = action === "easier"
    ? applyAction(app, athleteId, { type: "easier", date: tomorrow })
    : applyAction(app, athleteId, { type: "move", date: tomorrow, toDate: addDays(tomorrow, 1) });
  if (r.ok) {
    app.setSetting("tomorrowDismissed", { date });
    await writeCalendar(app, athleteId, date, addDays(date, 7)).catch(() => undefined);
  }
  return { ok: r.ok, text: r.text };
}

// ---------- B1: levels ----------

export function challengeFor(app: App, athleteId: number, w: { slug: string }) {
  const def = LIBRARY.find((d) => d.slug === w.slug);
  if (!def || !(LEVEL_CATEGORIES as string[]).includes(def.category) || def.level < 1) return null;
  const lvl = ladder(app, athleteId)[def.category] ?? 1;
  return { ...challenge(def.level, lvl), workoutLevel: def.level, athleteLevel: lvl, max: maxLevel(LIBRARY, def.category), category: CAT_PL[def.category] ?? def.category };
}

export function levelsView(app: App, athleteId: number) {
  const l = ladder(app, athleteId);
  return LEVEL_CATEGORIES.map((c) => ({ category: c, label: CAT_PL[c] ?? c, level: l[c] ?? 1, max: maxLevel(LIBRARY, c) }));
}

// ---------- B6: FTP confidence ----------

export function ftpView(app: App, athleteId: number) {
  const today = app.today();
  const phys = physiologyOn(app, athleteId, today);
  const hist: number[] = JSON.parse(app.db.meta(`eftp:${athleteId}`) ?? "[]");
  const best20s = app.db.all<{ b: number }>("SELECT best_20min AS b FROM activity WHERE athlete_id = ? AND sport = 'ride' AND best_20min IS NOT NULL AND date >= ?", athleteId, addDays(today, -42)).map((r) => r.b);
  const best5s = app.db.all<{ p: string }>("SELECT peaks_json AS p FROM activity WHERE athlete_id = ? AND peaks_json IS NOT NULL AND date >= ?", athleteId, addDays(today, -42))
    .map((r) => JSON.parse(r.p).p300 as number | null).filter((x): x is number => !!x);
  const test = app.db.get<{ d: ISODate | null }>("SELECT MAX(date) AS d FROM planned_workout WHERE athlete_id = ? AND workout_slug IN ('ramp-test','ftp-20') AND status IN ('completed','partial')", athleteId)?.d ?? null;
  return ftpInsight(phys.ftp, hist.at(-1) ?? null, best20s, best5s, test ? daysBetween(test, today) : null);
}

// ---------- D1: carbohydrate ----------

export function carbsView(app: App, athleteId: number) {
  const date = app.today();
  const w = (d: ISODate) => {
    const r = plannedActiveOn(app, athleteId, d);
    return r && r.status !== "skipped" ? (JSON.parse(r.workout_json) as ScaledWorkout) : null;
  };
  return carbAdvice(physiologyOn(app, athleteId, date).weightKg, w(date), w(addDays(date, 1)));
}

// ---------- D2: heat acclimation ----------

/**
 * 10–14 days of training in the heat before a hot event (Périard et al.;
 * up to ~8% better in the heat), stopping 2 days before. Optional: hot bath
 * 40 °C up to 40 min after an easy ride (Zurawlew et al. 2016: +4.9% TT in
 * 33 °C after 6 days; smaller benefit in well-trained cyclists, 2025).
 */
export function heatView(app: App, athleteId: number) {
  const today = app.today();
  const ev = seasonEvents(app, athleteId, today).find((e) => e.hot && daysBetween(today, e.date) >= 2 && daysBetween(today, e.date) <= 14);
  if (!ev) return null;
  const toGo = daysBetween(today, ev.date);
  const start = addDays(ev.date, -14);
  const sessions = app.db.get<{ n: number }>("SELECT COUNT(DISTINCT date) AS n FROM activity WHERE athlete_id = ? AND is_master = 1 AND date BETWEEN ? AND ?", athleteId, start, addDays(today, -1))!.n;
  return {
    event: ev.name,
    date: ev.date,
    daysToGo: toGo,
    sessions,
    target: 10,
    text: toGo <= 3
      ? `Aklimatyzacja przed „${ev.name}” praktycznie gotowa — ostatnie dni bez dodatkowego ciepła, dużo picia.`
      : `Aklimatyzacja do upału przed „${ev.name}” (za ${toGo} dni): dziś jedź w cieple — bez wentylatora albo cieplej ubrany, spokojnie 45–60 min, więcej picia. Sesji w cieple: ${sessions} z ok. 10.`,
    optional: "Opcjonalnie: gorąca kąpiel (do 40 °C, do 40 min) zaraz po spokojnej jeździe — tylko gdy zdrowie pozwala; przerwij przy zawrotach głowy.",
  };
}

// ---------- C3: form forecast for events and Long Ride Days ----------

/**
 * Target Form on the day, in % of Fitness (the same scale as the other Form
 * thresholds). A: intervals.icu "Fresh" zone +5…+20% (race ready; above
 * +20% is "Transition", fitness fades). B/C/Long Ride Day: our rule, less taper.
 */
const FORM_TARGET = { A: [5, 20], B: [-5, 15], C: [-15, 10], L: [-10, 15] } as const;

export function forecastView(app: App, athleteId: number) {
  const today = app.today();
  const targets = [
    ...seasonEvents(app, athleteId, today).map((e) => ({ date: e.date, name: e.name, kind: `wydarzenie ${e.priority}`, priority: e.priority })),
    ...app.db.all("SELECT proposed_date AS date, minutes FROM long_ride_proposal WHERE athlete_id = ? AND status = 'confirmed' AND proposed_date >= ?", athleteId, today)
      .map((l) => ({ date: l.date as ISODate, name: `Dzień długiej jazdy (${Math.round(l.minutes / 60)} h)`, kind: "długa jazda", priority: "L" })),
  ].filter((t) => daysBetween(today, t.date) <= 56).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!targets.length) return [];
  const loads = new Map<ISODate, number>();
  for (const r of plannedBetween(app, athleteId, today, addDays(today, 56))) loads.set(r.date, (loads.get(r.date) ?? 0) + JSON.parse(r.workout_json).load);
  const done = loadDone(app, athleteId, today, today);
  if (done) loads.set(today, Math.max(done, loads.get(today) ?? 0));
  const start = stateBefore(app, athleteId, today);
  return targets.map((t) => {
    const s = projectState(start, loads, today, t.date);
    const [lo, hi] = FORM_TARGET[t.priority as keyof typeof FORM_TARGET];
    const pctForm = s.formPct === null ? null : Math.round(s.formPct * 100);
    const verdict = pctForm === null ? "za krótka historia na prognozę"
      : pctForm < lo - 15 ? "zmęczony — rozważ lżejsze dni przed"
      : pctForm < lo ? "trochę poniżej celu — ostatnie 2–3 dni przed spokojniej"
      : pctForm > hi ? "bardzo świeży — możesz dorzucić spokojną jazdę w tygodniu przed"
      : "w docelowym zakresie";
    return { ...t, fitness: Math.round(s.fitness), form: Math.round(s.form), formPct: pctForm, target: [lo, hi], verdict, daysToGo: daysBetween(today, t.date) };
  });
}

// ---------- C4: return after a break ----------

/** Run in the daily job: a gap of ≥ 7 days without riding → gentle restart (once per break). */
export async function checkReturn(app: App, athleteId: number): Promise<boolean> {
  const today = app.today();
  const last = app.db.get<{ d: ISODate | null }>("SELECT MAX(date) AS d FROM activity WHERE athlete_id = ? AND sport = 'ride' AND is_master = 1 AND date < ?", athleteId, today)?.d;
  if (!last || last < addDays(today, -90)) return false;
  const daysOff = daysBetween(last, today) - 1;
  const plan = returnPlan(daysOff);
  if (!plan) return false;
  const key = `return_done:${athleteId}`;
  if (app.db.meta(key) === last) return false;
  if (activeNotes(app, athleteId, today).some((n) => n.kind === "travel" || n.kind === "illness")) return false;
  app.db.setMeta(key, last);
  const l = ladder(app, athleteId);
  for (const c of LEVEL_CATEGORIES) if (l[c]) l[c] = Math.max(1, l[c]! - plan.ladderDrop);
  setLadder(app, athleteId, l);
  if (plan.ftpFactor < 1 && !app.db.get("SELECT 1 FROM ftp_suggestion WHERE athlete_id = ? AND status = 'pending'", athleteId)) {
    const ftp = physiologyOn(app, athleteId, today).ftp;
    app.db.run("INSERT INTO ftp_suggestion (athlete_id, current_ftp, suggested_ftp, basis, evidence_json, created_at) VALUES (?,?,?,?,?,?)",
      athleteId, ftp, Math.round(ftp * plan.ftpFactor), "detraining", JSON.stringify({ daysOff }), nowIso());
  }
  app.db.setMeta(`return:${athleteId}`, JSON.stringify({ from: today, volumeFactor: plan.volumeFactor, easyDays: plan.easyDays, daysOff }));
  regenerate(app, athleteId, "return_after_break");
  return true;
}

export function returnInfo(app: App, athleteId: number) {
  const r = JSON.parse(app.db.meta(`return:${athleteId}`) ?? "null");
  if (!r || r.from < addDays(app.today(), -6)) return null;
  return { ...r, text: `Powrót po ${r.daysOff} dniach przerwy: pierwsze ${r.easyDays} dni spokojnie, tydzień ok. ${Math.round(r.volumeFactor * 100)}% zwykłej objętości, poziomy trudności niżej.` };
}

// ---------- C5: HIT block ----------

export function hitBlockInfo(app: App, athleteId: number) {
  const start = hitBlockStart(app);
  const today = app.today();
  const plan = app.db.get("SELECT starts_on FROM training_plan WHERE athlete_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", athleteId);
  const primary = goals(app, athleteId).find((g) => g.role === "primary");
  const days = availability(app, athleteId).days.filter((d) => d.available && d.maxMinutes >= 45).length;
  let candidate: ISODate | null = null;
  if (plan) {
    for (let m = nextMonday(today), i = 0; i < 8; m = addDays(m, 7), i++) {
      if (weekPosition(plan.starts_on, m).weekInBlock === 0) {
        candidate = m;
        break;
      }
    }
  }
  const nearEvent = candidate ? seasonEvents(app, athleteId, today).some((e) => e.priority === "A" && daysBetween(candidate!, e.date) >= 0 && daysBetween(candidate!, e.date) < 35) : false;
  const why =
    primary?.type !== "raise_ftp" ? "Blok interwałowy jest dla celu „Podnieść FTP”."
    : days < 3 ? "Potrzebne co najmniej 3 dni po ≥ 45 min w tygodniu."
    : nearEvent ? "Za blisko startu A (blok + 3 tygodnie)."
    : null;
  const active = start && addDays(start, 27) >= today ? { start, phase: start > today ? "zaplanowany" : daysBetween(start, today) < 7 ? "tydzień interwałów" : "3 tygodnie po bloku" } : null;
  return { active, candidate, available: !why && !active && !!candidate, why };
}

export function setHitBlock(app: App, athleteId: number, on: boolean): { ok: boolean; text: string } {
  const info = hitBlockInfo(app, athleteId);
  if (on && !info.available) return { ok: false, text: info.why ?? "Blok już zaplanowany." };
  app.setSetting("hitBlock", { weekStart: on ? info.candidate : null });
  regenerate(app, athleteId, on ? "hit_block" : "hit_block_cancel");
  return { ok: true, text: on ? `Blok interwałowy od ${info.candidate}: tydzień VO2max, potem 3 tygodnie z 1 sesją.` : "Blok interwałowy anulowany." };
}

// ---------- D3: weekly summary + stagnation ----------

export function snapshotLadder(app: App, athleteId: number): void {
  const key = `ladder_hist:${athleteId}`;
  const hist: Record<string, unknown> = JSON.parse(app.db.meta(key) ?? "{}");
  const monday = mondayOf(app.today());
  if (hist[monday]) return;
  hist[monday] = ladder(app, athleteId);
  const keys = Object.keys(hist).sort().slice(-12);
  app.db.setMeta(key, JSON.stringify(Object.fromEntries(keys.map((k) => [k, hist[k]]))));
}

export function weeklySummary(app: App, athleteId: number) {
  const today = app.today();
  const monday = mondayOf(today);
  if (weekday(today) > 3) return null; // Monday–Wednesday only
  if (app.setting<{ week: string | null }>("summaryDismissed", { week: null }).week === monday) return null;
  const from = addDays(monday, -7);
  const to = addDays(monday, -1);
  const rows = app.db.all("SELECT status FROM planned_workout WHERE athlete_id = ? AND date BETWEEN ? AND ? AND status IN ('completed','partial','missed','skipped','planned') AND role <> 'bonus'", athleteId, from, to);
  if (!rows.length && !app.db.get("SELECT 1 FROM activity WHERE athlete_id = ? AND date BETWEEN ? AND ?", athleteId, from, to)) return null;
  const done = rows.filter((r) => r.status === "completed" || r.status === "partial").length;
  const week = app.db.get("SELECT pw.target_load FROM plan_week pw JOIN training_plan tp ON tp.id = pw.plan_id WHERE tp.athlete_id = ? AND pw.week_start = ? ORDER BY tp.id DESC LIMIT 1", athleteId, from);
  const load = Math.round(loadDone(app, athleteId, from, to));
  const s0 = stateBefore(app, athleteId, from);
  const s1 = stateBefore(app, athleteId, monday);
  const count = (sport: string) => app.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM activity WHERE athlete_id = ? AND sport ${sport} AND is_master = 1 AND date BETWEEN ? AND ?`, athleteId, from, to)!.n;
  const others = count("<> 'ride'");
  const hist: Record<string, Record<string, number>> = JSON.parse(app.db.meta(`ladder_hist:${athleteId}`) ?? "{}");
  const prev = hist[from] ?? null;
  const cur = ladder(app, athleteId);
  const ups = prev ? LEVEL_CATEGORIES.filter((c) => (cur[c] ?? 1) > (prev[c] ?? 1)).map((c) => CAT_PL[c]) : [];
  const ftpNow = physiologyOn(app, athleteId, today).ftp;
  const ftpThen = physiologyOn(app, athleteId, from).ftp;
  const lines = [
    `${rows.length ? `Treningi: ${done} z ${rows.length} zaplanowanych` : `Jazdy: ${count("= 'ride'")}`}${others ? ` + ${others} w innych sportach` : ""}.`,
    `Obciążenie: ${load}${week ? ` (plan ${Math.round(week.target_load)})` : ""}. Kondycja ${Math.round(s0.fitness)} → ${Math.round(s1.fitness)}.`,
    ups.length ? `Poziom w górę: ${ups.join(", ")}.` : "Poziomy bez zmian.",
    ftpNow !== ftpThen ? `FTP: ${ftpThen} → ${ftpNow} W.` : `FTP: ${ftpNow} W.`,
  ];
  // Stagnation (our rule): 6 weeks with no level up, FTP flat (±1.5%) and Fitness not rising.
  const six = Object.keys(hist).sort().find((k) => k <= addDays(monday, -42));
  let stagnation: { text: string; action: "hit_block" | "recovery" | null } | null = null;
  if (six) {
    const old = hist[six]!;
    const levelUp = LEVEL_CATEGORIES.some((c) => (cur[c] ?? 1) > (old[c] ?? 1));
    const ftpOld = physiologyOn(app, athleteId, six).ftp;
    const fitOld = stateBefore(app, athleteId, six).fitness;
    if (!levelUp && Math.abs(ftpNow - ftpOld) / ftpOld <= 0.015 && s1.fitness <= fitOld + 2) {
      const hit = hitBlockInfo(app, athleteId);
      stagnation = hit.available
        ? { text: "Od 6 tygodni bez postępu (poziomy, FTP i Kondycja stoją). Nowy bodziec: blok interwałowy (Rønnestad: +4,6% VO2max).", action: "hit_block" }
        : { text: "Od 6 tygodni bez postępu. Sprawdź sen i regenerację; tydzień lżej często odblokowuje postęp.", action: null };
    }
  }
  return { weekStart: from, lines, stagnation };
}

/** Accept a detraining FTP suggestion without changing anything else (used by C4 tests). */
export function acceptFtp(app: App, athleteId: number, ftp: number, source: string): void {
  addSnapshot(app, athleteId, app.today(), { ftp }, source);
}

export { performanceSeries };

/** Today screen with the research features (A1, A4, B1, C4, D1–D3). */
export function todayFull(app: App, athleteId: number) {
  const t = todayView(app, athleteId);
  return {
    ...t,
    workout: t.workout ? { ...t.workout, challenge: challengeFor(app, athleteId, t.workout) } : null,
    bonusOffer: t.restDay && !t.skippedToday ? bonusView(app, athleteId) : null,
    tomorrow: tomorrowView(app, athleteId),
    carbs: carbsView(app, athleteId),
    heat: heatView(app, athleteId),
    summary: weeklySummary(app, athleteId),
    comeback: returnInfo(app, athleteId),
  };
}

export const durabilityViewSafe = (app: App, athleteId: number) => durabilityView(app, athleteId);
