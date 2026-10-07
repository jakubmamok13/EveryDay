import { addDays, daysBetween, type ISODate } from "@everyday/shared";
import { compliance, eftpFromBest20, findDuplicates, ftpFromRampTest, ftpSuggestion, otherSportLoad, performanceSeries, powerLoad, sportGroup, SPORT_WEIGHTS, type SportGroup } from "@everyday/engine";
import type { App } from "../app";
import { nowIso } from "../db";
import type { IcuActivity } from "../icu";
import { logJob, physiologyOn, type PlannedRow } from "../repo";

function activityLoad(a: IcuActivity, ftp: number, lthr: number | null): { load: number | null; basis: string } {
  const group = sportGroup(a.type);
  if (group !== "ride") return { load: otherSportLoad(group, a.movingSeconds, a.load), basis: a.load ? "icu" : "default" };
  if (a.load !== null) return { load: a.load, basis: a.weightedPower ? "power" : "hr" };
  if (a.weightedPower) return { load: powerLoad(a.movingSeconds, a.weightedPower, ftp), basis: "power" };
  if (a.avgHr && lthr) return { load: (a.movingSeconds / 3600) * (a.avgHr / lthr) ** 2 * 100, basis: "hr" };
  return { load: null, basis: "none" };
}

export async function syncAll(app: App, athleteId: number, days = 14): Promise<{ activities: number; wellness: number }> {
  const icu = app.icu();
  if (!icu) return { activities: 0, wellness: 0 };
  return logJob(app, "sync", async () => {
    const today = app.today();
    const oldest = addDays(today, -days);
    try {
      const [acts, well] = await Promise.all([icu.activities(oldest, today), icu.wellness(oldest, today)]);
      app.db.tx(() => {
        for (const a of acts) {
          if (a.stub || !a.startLocal) continue;
          const date = a.startLocal.slice(0, 10);
          const phys = physiologyOn(app, athleteId, date);
          const { load, basis } = activityLoad(a, phys.ftp, phys.lthr);
          const ride = sportGroup(a.type) === "ride";
          app.db.run(
            `INSERT INTO activity (athlete_id, icu_id, source_device, type, name, date, start_at, moving_seconds, distance_m, elevation_m,
               avg_power, weighted_power, avg_hr, max_hr, load, load_basis, best_1min, best_20min, raw_json, created_at, sport)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(icu_id) DO UPDATE SET source_device = excluded.source_device, type = excluded.type, name = excluded.name,
               date = excluded.date, start_at = excluded.start_at, moving_seconds = excluded.moving_seconds, distance_m = excluded.distance_m,
               elevation_m = excluded.elevation_m, avg_power = excluded.avg_power, weighted_power = excluded.weighted_power,
               avg_hr = excluded.avg_hr, max_hr = excluded.max_hr, load = excluded.load, load_basis = excluded.load_basis,
               best_1min = excluded.best_1min, best_20min = excluded.best_20min, raw_json = excluded.raw_json, sport = excluded.sport`,
            athleteId, a.id, a.source, ride ? (a.indoor ? "VirtualRide" : "Ride") : a.type, a.name, date, a.startLocal, a.movingSeconds, a.distanceM,
            a.elevationM, a.avgPower, a.weightedPower, a.avgHr, a.maxHr, load, basis, ride ? a.best1min : null, ride ? a.best20min : null,
            JSON.stringify(a.raw), nowIso(), sportGroup(a.type),
          );
        }
        for (const w of well) {
          app.db.run(
            `INSERT INTO wellness_day (athlete_id, date, hrv, resting_hr, sleep_seconds, sleep_score, body_battery_max, body_battery_min,
               garmin_readiness, stress_avg, weight_kg, raw_json, fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(athlete_id, date) DO UPDATE SET hrv = excluded.hrv, resting_hr = excluded.resting_hr,
               sleep_seconds = excluded.sleep_seconds, sleep_score = excluded.sleep_score, body_battery_max = excluded.body_battery_max,
               body_battery_min = excluded.body_battery_min, garmin_readiness = excluded.garmin_readiness, stress_avg = excluded.stress_avg,
               weight_kg = excluded.weight_kg, raw_json = excluded.raw_json, fetched_at = excluded.fetched_at`,
            athleteId, w.date, w.hrv, w.restingHr, w.sleepSeconds, w.sleepScore, w.bodyBatteryMax, w.bodyBatteryMin, w.readiness,
            w.stress, w.weightKg, JSON.stringify(w.raw), nowIso(),
          );
        }
      });
      dedupe(app, athleteId, addDays(oldest, -1), today);
      matchToPlan(app, athleteId, oldest, today);
      app.db.run(
        "UPDATE source_connection SET last_sync_at = ?, status = 'ok', last_error = NULL WHERE athlete_id = ? AND provider = 'intervals_icu'",
        nowIso(), athleteId,
      );
      recomputePerformance(app, athleteId);
      return { activities: acts.length, wellness: well.length };
    } catch (e: any) {
      app.db.run(
        "UPDATE source_connection SET status = ?, last_error = ? WHERE athlete_id = ? AND provider = 'intervals_icu'",
        e?.code === "auth_error" ? "auth_error" : "unreachable", String(e?.message ?? e).slice(0, 200), athleteId,
      );
      throw e;
    }
  });
}

/** Master Copy rule (D-024, D-029): each ride counts once. */
export function dedupe(app: App, athleteId: number, from: ISODate, to: ISODate): void {
  const rows = app.db.all("SELECT * FROM activity WHERE athlete_id = ? AND sport = 'ride' AND date BETWEEN ? AND ?", athleteId, from, to);
  const dup = findDuplicates(
    rows.map((r) => ({
      id: r.icu_id,
      startMs: Date.parse(r.start_at + "Z"),
      durationSec: r.moving_seconds,
      source: r.source_device,
      indoor: r.type === "VirtualRide",
      hasPower: r.weighted_power !== null,
    })),
  );
  app.db.tx(() => {
    for (const r of rows) {
      const of = dup.get(r.icu_id) ?? null;
      app.db.run("UPDATE activity SET is_master = ?, duplicate_of = ? WHERE id = ?", of ? 0 : 1, of, r.id);
    }
  });
}

function matchToPlan(app: App, athleteId: number, from: ISODate, to: ISODate): void {
  const acts = app.db.all(
    "SELECT * FROM activity WHERE athlete_id = ? AND sport = 'ride' AND date BETWEEN ? AND ? AND is_master = 1 ORDER BY date, moving_seconds DESC",
    athleteId, from, to,
  );
  for (const a of acts) {
    if (a.planned_workout_id) continue;
    const p = app.db.get<PlannedRow>(
      `SELECT * FROM planned_workout WHERE athlete_id = ? AND date = ? AND status IN ('planned','missed')
       AND id NOT IN (SELECT planned_workout_id FROM activity WHERE planned_workout_id IS NOT NULL) ORDER BY is_key DESC, id LIMIT 1`,
      athleteId, a.date,
    );
    if (!p) continue;
    const w = JSON.parse(p.workout_json);
    const c = compliance({ minutes: w.minutes, load: w.load }, { minutes: Math.round(a.moving_seconds / 60), load: a.load });
    app.db.run("UPDATE activity SET planned_workout_id = ?, compliance_pct = ? WHERE id = ?", p.id, c, a.id);
    app.db.run("UPDATE planned_workout SET status = ?, updated_at = ? WHERE id = ?", c >= 80 ? "completed" : "partial", nowIso(), p.id);
    if (p.workout_slug === "ramp-test") {
      const phys = physiologyOn(app, athleteId, a.date);
      const suggested = a.best_1min ? ftpFromRampTest(a.best_1min) : 0;
      if (!app.db.get("SELECT id FROM ftp_suggestion WHERE athlete_id = ? AND status = 'pending'", athleteId)) {
        app.db.run(
          "INSERT INTO ftp_suggestion (athlete_id, current_ftp, suggested_ftp, basis, evidence_json, created_at) VALUES (?,?,?,?,?,?)",
          athleteId, phys.ftp, suggested, "ramp_test", JSON.stringify({ activity: a.icu_id, best1min: a.best_1min }), nowIso(),
        );
      }
    }
  }
}

/** Whether other sports count in Fitness / Fatigue (D-047, default on). */
export const countsOtherSports = (app: App): boolean => app.setting("otherSports", { enabled: true }).enabled;

/**
 * Load, Fitness, Fatigue, Form for every day from the first activity to today
 * (D-010). Other sports: sport-weighted, the same in Fitness and Fatigue (D-047, D-069).
 */
export function recomputePerformance(app: App, athleteId: number): void {
  const today = app.today();
  const others = countsOtherSports(app);
  const rows = app.db.all<{ date: ISODate; sport: SportGroup; load: number }>(
    "SELECT date, sport, SUM(load) AS load FROM activity WHERE athlete_id = ? AND is_master = 1 AND load IS NOT NULL GROUP BY date, sport",
    athleteId,
  );
  // Other sports count with their cycling weight in Fitness and Fatigue alike (D-069).
  const loads = new Map<ISODate, number>();
  for (const r of rows) {
    if (r.sport !== "ride" && !others) continue;
    const w = SPORT_WEIGHTS[r.sport] ?? SPORT_WEIGHTS.other;
    loads.set(r.date, (loads.get(r.date) ?? 0) + r.load * w.weight);
  }
  const first = [...loads.keys()].sort()[0] ?? today;
  const from = first < addDays(today, -365) ? addDays(today, -365) : first;
  const series = performanceSeries(loads, from, addDays(today, 1));
  const now = nowIso();
  app.db.tx(() => {
    for (const d of series) {
      app.db.run(
        `INSERT INTO daily_state (athlete_id, date, load, fitness, fatigue, form, form_pct, computed_at) VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(athlete_id, date) DO UPDATE SET load = excluded.load, fitness = excluded.fitness, fatigue = excluded.fatigue,
           form = excluded.form, form_pct = excluded.form_pct, computed_at = excluded.computed_at`,
        athleteId, d.date, d.load, d.fitness, d.fatigue, d.form, d.formPct, now,
      );
    }
  });
}

/** eFTP suggestion (D-036): two consistent estimates ≥ 3% away from the current FTP. */
export async function checkFtp(app: App, athleteId: number): Promise<void> {
  const today = app.today();
  if (app.db.get("SELECT id FROM ftp_suggestion WHERE athlete_id = ? AND status = 'pending'", athleteId)) return;
  const phys = physiologyOn(app, athleteId, today);
  let estimate: number | null = null;
  try {
    estimate = (await app.icu()?.athlete())?.eftp ?? null;
  } catch {
    estimate = null;
  }
  if (estimate === null) {
    const best = app.db.get("SELECT MAX(best_20min) AS b FROM activity WHERE athlete_id = ? AND sport = 'ride' AND is_master = 1 AND date >= ?", athleteId, addDays(today, -42))?.b;
    estimate = best ? eftpFromBest20(best) : null;
  }
  if (estimate === null) return;
  const hist: number[] = JSON.parse(app.db.meta(`eftp:${athleteId}`) ?? "[]");
  hist.push(Math.round(estimate));
  app.db.setMeta(`eftp:${athleteId}`, JSON.stringify(hist.slice(-5)));
  const rej = app.db.get<{ suggested_ftp: number; decided_at: string }>(
    "SELECT suggested_ftp, decided_at FROM ftp_suggestion WHERE athlete_id = ? AND status = 'rejected' ORDER BY id DESC LIMIT 1", athleteId,
  );
  const rejected = rej ? { ftp: rej.suggested_ftp, daysAgo: rej.decided_at ? daysBetween(rej.decided_at.slice(0, 10) as ISODate, today) : 0 } : null;
  const s = ftpSuggestion(phys.ftp, hist, rejected);
  if (s !== null) {
    app.db.run(
      "INSERT INTO ftp_suggestion (athlete_id, current_ftp, suggested_ftp, basis, evidence_json, created_at) VALUES (?,?,?,?,?,?)",
      athleteId, phys.ftp, s, "eftp", JSON.stringify({ estimates: hist.slice(-2) }), nowIso(),
    );
  }
}
