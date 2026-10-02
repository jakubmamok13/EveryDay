import { addDays, mondayOf, WEEKDAY_PL_LONG, weekday, type CheckIn, type ISODate, type Readiness, type RideMode, type ScaledWorkout } from "@everyday/shared";
import { LIBRARY } from "@everyday/library";
import {
  adapt,
  assembleBrief,
  buildBriefFacts,
  computeReadiness,
  displaySteps,
  findWorkout,
  moveMissedKey,
  pickWorkout,
  progressLadder,
  readinessReason,
  READINESS_EMOJI,
  READINESS_WORD,
  scaleWorkout,
  type AdaptResult,
} from "@everyday/engine";
import { PROMPT_VERSION } from "@everyday/coach";
import type { App } from "../app";
import { nowIso } from "../db";
import {
  activeNotes,
  availability,
  checkIn,
  dailyState,
  ladder,
  physiologyOn,
  plannedActiveOn,
  plannedBetween,
  setLadder,
  toPlannedDay,
  wellnessRange,
  type PlannedRow,
} from "../repo";
import { writeBrief } from "./coach";
import { applyChange, insertWorkout, moveWorkout, setRideMode, undo, writeCalendar } from "./plan";

export function computeReadinessFor(app: App, athleteId: number, date: ISODate, withCheckIn: boolean): Readiness {
  const learning = app.db.get("SELECT learning_until FROM athlete WHERE id = ?", athleteId)?.learning_until ?? null;
  const r = computeReadiness({
    date,
    wellness: wellnessRange(app, athleteId, addDays(date, -70), date),
    checkIn: withCheckIn ? checkIn(app, athleteId, date) : null,
    formPct: dailyState(app, athleteId, date)?.form_pct ?? null,
    learningUntil: learning,
    activeNotes: activeNotes(app, athleteId, date),
  });
  app.db.run(
    `INSERT INTO daily_state (athlete_id, date, readiness_score, readiness_state, readiness_json, computed_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(athlete_id, date) DO UPDATE SET readiness_score = excluded.readiness_score, readiness_state = excluded.readiness_state,
       readiness_json = excluded.readiness_json`,
    athleteId, date, r.score, r.state, JSON.stringify(r), nowIso(),
  );
  return r;
}

function rideModeFor(app: App, athleteId: number, date: ISODate): RideMode {
  const c = checkIn(app, athleteId, date);
  if (c) return c.rideMode;
  const row = plannedActiveOn(app, athleteId, date);
  if (row) return row.ride_mode;
  return availability(app, athleteId).days.find((d) => d.weekday === weekday(date))?.defaultRideMode ?? "indoor";
}

/** Morning decision: readiness → adaptation (auto, D-014) → brief. */
export async function runMorning(app: App, athleteId: number, date: ISODate, withCheckIn: boolean): Promise<void> {
  // Re-running (e.g. a corrected check-in) starts from the original plan.
  for (const a of app.db.all("SELECT id FROM adaptation WHERE athlete_id = ? AND date = ? AND origin = 'engine' AND undone_at IS NULL AND action NOT IN ('long_ride_day','progression')", athleteId, date)) {
    undo(app, athleteId, a.id);
  }
  const readiness = computeReadinessFor(app, athleteId, date, withCheckIn);
  const row = plannedActiveOn(app, athleteId, date);
  const phys = physiologyOn(app, athleteId, date);
  const rideMode = rideModeFor(app, athleteId, date);
  let res: AdaptResult | null = null;
  const before = row && row.status === "planned" ? toPlannedDay(row) : null;

  if (row && before) {
    const yesterdayJson = dailyState(app, athleteId, addDays(date, -1))?.readiness_json;
    const recentlySick = !!app.db.get("SELECT 1 FROM check_in WHERE athlete_id = ? AND date BETWEEN ? AND ? AND sick = 1", athleteId, addDays(date, -2), addDays(date, -1));
    res = adapt({
      date,
      readiness,
      planned: before,
      yesterday: yesterdayJson ? JSON.parse(yesterdayJson).effective : null,
      recentlySick,
      laterThisWeek: plannedBetween(app, athleteId, addDays(date, 1), addDays(mondayOf(date), 6)).map(toPlannedDay),
      library: LIBRARY,
    });
  }

  const todayDay = res && before ? (res.workout ? { ...before, workout: res.workout } : null) : row && row.status !== "skipped" ? toPlannedDay(row) : null;
  const upcoming = plannedBetween(app, athleteId, addDays(date, 1), addDays(date, 7)).map(toPlannedDay);
  const facts = buildBriefFacts({
    date,
    readiness,
    withCheckIn,
    today: todayDay,
    before,
    adaptation: res,
    rideMode,
    physiology: phys,
    upcoming,
    gutLevel: app.db.get("SELECT gut_level FROM athlete WHERE id = ?", athleteId)?.gut_level ?? 0,
  });

  if (row && res && res.action !== "keep") {
    const text = facts.change?.text ?? res.action;
    if (res.action === "swap" && res.swapWith) moveWorkout(app, athleteId, row, res.swapWith, "engine", res.reasons, text);
    else applyChange(app, athleteId, row, res.workout, "engine", res.action, res.reasons, text);
    if (res.keyMissed && before) rescheduleKey(app, athleteId, date, before.workout, row);
  }

  const written = await writeBrief(app, facts);
  const { lines, text } = assembleBrief(facts, written.slots);
  app.db.run(
    `INSERT INTO daily_brief (athlete_id, date, facts_json, text_pl, lines_json, slots_source_json, model, prompt_version, validator_passed, with_check_in, generated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(athlete_id, date) DO UPDATE SET facts_json = excluded.facts_json, text_pl = excluded.text_pl,
       lines_json = excluded.lines_json, slots_source_json = excluded.slots_source_json, model = excluded.model,
       prompt_version = excluded.prompt_version, validator_passed = excluded.validator_passed, with_check_in = excluded.with_check_in,
       generated_at = excluded.generated_at`,
    athleteId, date, JSON.stringify(facts), text, JSON.stringify(lines), JSON.stringify(written.sources), written.model,
    PROMPT_VERSION, written.validatorPassed ? 1 : 0, withCheckIn ? 1 : 0, nowIso(),
  );
  await writeCalendar(app, athleteId, date, addDays(date, 7)).catch(() => undefined);
}

/**
 * Rebuild today's brief from the current state (after undo, chat or buttons)
 * without running the adaptation again.
 */
export async function refreshBrief(app: App, athleteId: number, date: ISODate): Promise<void> {
  const withCheckIn = !!checkIn(app, athleteId, date);
  const readiness = computeReadinessFor(app, athleteId, date, withCheckIn);
  const row = plannedActiveOn(app, athleteId, date);
  const last = app.db.get("SELECT * FROM adaptation WHERE athlete_id = ? AND date = ? AND undone_at IS NULL ORDER BY id DESC LIMIT 1", athleteId, date);
  const facts = buildBriefFacts({
    date,
    readiness,
    withCheckIn,
    today: row && row.status !== "skipped" ? toPlannedDay(row) : null,
    rideMode: rideModeFor(app, athleteId, date),
    physiology: physiologyOn(app, athleteId, date),
    upcoming: plannedBetween(app, athleteId, addDays(date, 1), addDays(date, 7)).map(toPlannedDay),
    gutLevel: app.db.get("SELECT gut_level FROM athlete WHERE id = ?", athleteId)?.gut_level ?? 0,
  });
  if (last?.text) {
    const t = String(last.text).replace(/\.$/, "") + ".";
    facts.change = { action: last.action, text: t };
    facts.templates.change = t;
    facts.numbers = [...new Set([...facts.numbers, ...(t.match(/\d+(?:[.,]\d+)?/g) ?? [])])];
  }
  const written = await writeBrief(app, facts);
  const { lines, text } = assembleBrief(facts, written.slots);
  app.db.run(
    `INSERT INTO daily_brief (athlete_id, date, facts_json, text_pl, lines_json, slots_source_json, model, prompt_version, validator_passed, with_check_in, generated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(athlete_id, date) DO UPDATE SET facts_json = excluded.facts_json, text_pl = excluded.text_pl,
       lines_json = excluded.lines_json, slots_source_json = excluded.slots_source_json, model = excluded.model,
       prompt_version = excluded.prompt_version, validator_passed = excluded.validator_passed, with_check_in = excluded.with_check_in,
       generated_at = excluded.generated_at`,
    athleteId, date, JSON.stringify(facts), text, JSON.stringify(lines), JSON.stringify(written.sources), written.model,
    PROMPT_VERSION, written.validatorPassed ? 1 : 0, withCheckIn ? 1 : 0, nowIso(),
  );
}

/** A Key Workout lost to a red/sick day moves to a free day this week (R8-11). */
function rescheduleKey(app: App, athleteId: number, date: ISODate, workout: ScaledWorkout, row: PlannedRow): void {
  const later = plannedBetween(app, athleteId, addDays(date, 1), addDays(mondayOf(date), 6)).map(toPlannedDay);
  const to = moveMissedKey({
    missed: { date, isKey: true, role: row.role, workout },
    laterThisWeek: later,
    availableWeekdays: availability(app, athleteId).days.filter((d) => d.available).map((d) => d.weekday),
    neighbours: plannedBetween(app, athleteId, date, addDays(mondayOf(date), 7)).map(toPlannedDay),
    formPct: dailyState(app, athleteId, date)?.form_pct ?? null,
  });
  if (!to) return;
  const there = plannedActiveOn(app, athleteId, to);
  if (there) app.db.run("UPDATE planned_workout SET status = 'replaced', delivery_status = 'pending' WHERE id = ?", there.id);
  insertWorkout(app, athleteId, to, row.role, true, workout, there?.ride_mode ?? row.ride_mode, "engine", ["missed"], `„${workout.name}” przeniesiony na ${WEEKDAY_PL_LONG[weekday(to)]}`);
}

export async function submitCheckIn(app: App, athleteId: number, c: Omit<CheckIn, "date"> & { bonusMinutes?: number }): Promise<void> {
  const date = app.today();
  app.db.run(
    `INSERT INTO check_in (athlete_id, date, sleep_quality, legs, motivation, sick, pain, pain_note, ride_mode, bonus_minutes, submitted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(athlete_id, date) DO UPDATE SET sleep_quality = excluded.sleep_quality, legs = excluded.legs,
       motivation = excluded.motivation, sick = excluded.sick, pain = excluded.pain, pain_note = excluded.pain_note,
       ride_mode = excluded.ride_mode, bonus_minutes = excluded.bonus_minutes, submitted_at = excluded.submitted_at`,
    athleteId, date, c.sleepQuality, c.legs, c.motivation, c.sick ? 1 : 0, c.pain ? 1 : 0, c.painNote ?? null, c.rideMode, c.bonusMinutes ?? null, nowIso(),
  );
  if (c.pain && c.painNote) {
    app.db.run("INSERT INTO chat_note (athlete_id, kind, text, start_date, end_date, created_at) VALUES (?,?,?,?,?,?)",
      athleteId, "injury", c.painNote, date, addDays(date, 7), nowIso());
  }
  setRideMode(app, athleteId, date, c.rideMode, "check_in");
  await runMorning(app, athleteId, date, true);
}

/** Rest day "Mam dziś czas" (D-027): optional easy session that never hurts the next Key Workout. */
export async function addBonus(app: App, athleteId: number, minutes: number, rideMode: RideMode): Promise<number | null> {
  const date = app.today();
  if (plannedActiveOn(app, athleteId, date)) return null;
  const json = dailyState(app, athleteId, date)?.readiness_json;
  const state = json ? JSON.parse(json).effective : "green";
  const w = state === "green" && minutes >= 45
    ? scaleWorkout(findWorkout(LIBRARY, "endurance-z2"), { targetMinutes: Math.min(minutes, 120) })
    : scaleWorkout(findWorkout(LIBRARY, minutes >= 45 ? "recovery-45" : "recovery-30"));
  const id = insertWorkout(app, athleteId, date, "bonus", false, w, rideMode, "bonus", ["bonus"], `bonus: ${w.name}`);
  await refreshBrief(app, athleteId, date);
  return id;
}

export function rateRide(app: App, athleteId: number, activityId: number, rpe: number, feel: string): void {
  app.db.run("UPDATE activity SET rpe = ?, feel = ? WHERE id = ? AND athlete_id = ?", rpe, feel, activityId, athleteId);
  const rides = app.db
    .all(
      `SELECT a.date, a.compliance_pct, a.feel, p.workout_json FROM activity a JOIN planned_workout p ON p.id = a.planned_workout_id
       WHERE a.athlete_id = ? AND a.date >= ? AND a.feel IS NOT NULL ORDER BY a.date`,
      athleteId, addDays(app.today(), -60),
    )
    .map((r) => ({ date: r.date, category: JSON.parse(r.workout_json).category, compliancePct: r.compliance_pct, feel: r.feel }));
  const { ladder: next, changes } = progressLadder(ladder(app, athleteId), rides);
  if (!changes.length) return;
  setLadder(app, athleteId, next);
  // Apply the new step to the next sessions of that category (M4.6).
  const today = app.today();
  for (const ch of changes) {
    for (const row of plannedBetween(app, athleteId, addDays(today, 1), addDays(today, 14))) {
      const w = JSON.parse(row.workout_json) as ScaledWorkout;
      if (w.category !== ch.category || row.status !== "planned" || ch.category === "long_ride") continue;
      const curLevel = LIBRARY.find((d) => d.slug === w.slug)?.level ?? 1;
      const max = availability(app, athleteId).days.find((d) => d.weekday === weekday(row.date))?.maxMinutes ?? w.minutes;
      const def = pickWorkout(LIBRARY, ch.category, curLevel + ch.delta, max, ch.delta > 0 ? w.slug : undefined);
      if (!def || def.slug === w.slug) continue;
      applyChange(app, athleteId, row, scaleWorkout(def), "engine", "progression", [ch.delta > 0 ? "too_easy" : "too_hard"],
        ch.delta > 0 ? `o stopień trudniej: ${def.name.replace("{n}", "")}` : `o stopień łatwiej: ${def.name.replace("{n}", "")}`);
      break;
    }
  }
}

// ---------- Today view for the PWA ----------

export function todayView(app: App, athleteId: number) {
  const date = app.today();
  const phys = physiologyOn(app, athleteId, date);
  const ci = checkIn(app, athleteId, date);
  const state = dailyState(app, athleteId, date);
  const r: Readiness | null = state?.readiness_json ? JSON.parse(state.readiness_json) : null;
  const brief = app.db.get("SELECT * FROM daily_brief WHERE athlete_id = ? AND date = ?", athleteId, date);
  const row = plannedActiveOn(app, athleteId, date);
  const w = row ? (JSON.parse(row.workout_json) as ScaledWorkout) : null;
  const change = app.db.get(
    "SELECT id, text, origin, action FROM adaptation WHERE athlete_id = ? AND date = ? AND undone_at IS NULL ORDER BY id DESC LIMIT 1", athleteId, date,
  );
  const unrated = app.db.all(
    `SELECT a.id, a.name, a.date, a.moving_seconds, a.compliance_pct, p.workout_json FROM activity a LEFT JOIN planned_workout p ON p.id = a.planned_workout_id
     WHERE a.athlete_id = ? AND a.is_master = 1 AND a.feel IS NULL AND a.date >= ? ORDER BY a.date DESC LIMIT 3`,
    athleteId, addDays(date, -2),
  );
  const conn = app.db.get("SELECT status, last_sync_at, last_error FROM source_connection WHERE athlete_id = ? AND provider = 'intervals_icu'", athleteId);
  const garmin = r?.inputs.find((i) => i.key === "garmin_readiness")?.value ?? null;
  const skipped = app.db.get("SELECT 1 FROM planned_workout WHERE athlete_id = ? AND date = ? AND status = 'skipped'", athleteId, date);
  return {
    date,
    weekday: WEEKDAY_PL_LONG[weekday(date)],
    demo: app.config.demo,
    checkIn: ci,
    defaultRideMode: rideModeFor(app, athleteId, date),
    readiness: r && {
      state: r.state,
      effective: r.effective,
      score: r.score,
      word: READINESS_WORD[r.state],
      emoji: READINESS_EMOJI[r.state],
      reason: readinessReason(r, !!ci),
      garmin,
      inputs: r.inputs,
    },
    brief: brief && { lines: JSON.parse(brief.lines_json), withCheckIn: !!brief.with_check_in, generatedAt: brief.generated_at, sources: JSON.parse(brief.slots_source_json ?? "{}") },
    workout: row && w && {
      id: row.id,
      name: w.name,
      slug: w.slug,
      minutes: w.minutes,
      load: w.load,
      category: w.category,
      intensity: w.intensity,
      isKey: !!row.is_key,
      role: row.role,
      rideMode: row.ride_mode,
      status: row.status,
      deliveryStatus: row.delivery_status,
      purpose: w.purpose,
      guidance: w.outdoorGuidance ?? null,
      steps: displaySteps(w, phys),
    },
    restDay: !row,
    skippedToday: !!skipped,
    change: change && { id: change.id, text: change.text, origin: change.origin, action: change.action },
    unrated: unrated.map((u) => ({
      id: u.id,
      name: u.workout_json ? JSON.parse(u.workout_json).name : u.name ?? "Jazda",
      date: u.date,
      minutes: Math.round(u.moving_seconds / 60),
      compliance: u.compliance_pct,
    })),
    ftpSuggestion: app.db.get("SELECT id, current_ftp, suggested_ftp, basis FROM ftp_suggestion WHERE athlete_id = ? AND status = 'pending'", athleteId) ?? null,
    longRide: app.db.get("SELECT id, proposed_date, minutes FROM long_ride_proposal WHERE athlete_id = ? AND status = 'proposed'", athleteId) ?? null,
    upcoming: plannedBetween(app, athleteId, addDays(date, 1), addDays(date, 3)).map((u) => {
      const uw = JSON.parse(u.workout_json) as ScaledWorkout;
      return { date: u.date, name: uw.name, minutes: uw.minutes, isKey: !!u.is_key };
    }),
    sync: conn ? { status: conn.status, lastSyncAt: conn.last_sync_at, error: conn.last_error } : null,
    physiology: phys,
  };
}
