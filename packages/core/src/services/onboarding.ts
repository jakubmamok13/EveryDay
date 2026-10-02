import { addDays, type AvailabilityDay, type Goal, type ISODate } from "@everyday/shared";
import type { App } from "../app";
import { nowIso } from "../db";
import { RealIcuClient } from "../icu";
import { ensurePlan, regenerate, writeCalendar } from "./plan";
import { syncAll } from "./sync";

export interface OnboardingInput {
  profile: {
    displayName?: string;
    weightKg: number;
    heightCm?: number | null;
    ftp: number;
    lthr?: number | null;
    maxHr?: number | null;
    outdoorPowerMeter?: boolean;
  };
  goals: Goal[];
  availability: { days: AvailabilityDay[]; longRideDaysAllowed: boolean; longRideEveryWeeks: number };
  equipment: { kind: string; model: string; role?: string | null }[];
  health?: { kind: "injury" | "illness"; text: string } | null;
}

/** Test the intervals.icu key and keep it on this phone only; returns pre-fill values (R8-04). */
export async function connectIcu(app: App, apiKey: string, externalId = "0") {
  const athleteId = app.requireAthlete();
  const client = new RealIcuClient(apiKey.trim(), externalId || "0");
  const a = await client.athlete();
  app.db.run(
    `INSERT INTO source_connection (athlete_id, provider, external_athlete_id, api_key_encrypted, status) VALUES (?,?,?,?,'ok')
     ON CONFLICT(athlete_id, provider) DO UPDATE SET external_athlete_id = excluded.external_athlete_id, api_key_encrypted = excluded.api_key_encrypted, status = 'ok'`,
    athleteId, "intervals_icu", a.id, apiKey.trim(),
  );
  app.resetIcu();
  return a;
}

export function saveGoals(app: App, athleteId: number, goals: Goal[]): void {
  app.db.run("UPDATE goal SET status = 'archived', archived_at = ? WHERE athlete_id = ? AND status = 'active'", nowIso(), athleteId);
  for (const g of goals) {
    const { role, type, eventName, eventDate, priority, ...target } = g;
    app.db.run(
      "INSERT INTO goal (athlete_id, role, type, target_json, event_name, event_date, priority, created_at) VALUES (?,?,?,?,?,?,?,?)",
      athleteId, role, type, JSON.stringify(target), eventName ?? null, eventDate ?? null, priority ?? null, nowIso(),
    );
  }
}

export function saveAvailability(app: App, athleteId: number, a: OnboardingInput["availability"]): void {
  const id = app.db.run(
    "INSERT INTO availability (athlete_id, effective_from, long_ride_days_allowed, long_ride_every_weeks, created_at) VALUES (?,?,?,?,?)",
    athleteId, app.today(), a.longRideDaysAllowed ? 1 : 0, a.longRideEveryWeeks, nowIso(),
  ).id;
  for (const d of a.days) {
    app.db.run(
      "INSERT INTO availability_day (availability_id, weekday, available, max_minutes, default_ride_mode, notify_time) VALUES (?,?,?,?,?,?)",
      id, d.weekday, d.available ? 1 : 0, d.available ? d.maxMinutes : 0, d.defaultRideMode, d.notifyTime,
    );
  }
}

export async function completeOnboarding(app: App, input: OnboardingInput): Promise<void> {
  const athleteId = app.requireAthlete();
  const today = app.today();
  app.db.tx(() => {
    app.db.run("UPDATE athlete SET display_name = ?, height_cm = ?, outdoor_power_meter = ? WHERE id = ?",
      input.profile.displayName ?? null, input.profile.heightCm ?? null, input.profile.outdoorPowerMeter ? 1 : 0, athleteId);
    app.db.run("DELETE FROM fitness_snapshot WHERE athlete_id = ?", athleteId);
    app.db.run(
      "INSERT INTO fitness_snapshot (athlete_id, effective_from, ftp_w, lthr_bpm, max_hr_bpm, weight_kg, source, created_at) VALUES (?,?,?,?,?,?,?,?)",
      athleteId, addDays(today, -400), input.profile.ftp, input.profile.lthr ?? null, input.profile.maxHr ?? null, input.profile.weightKg, "onboarding", nowIso(),
    );
    saveGoals(app, athleteId, input.goals);
    saveAvailability(app, athleteId, input.availability);
    app.db.run("DELETE FROM equipment WHERE athlete_id = ?", athleteId);
    for (const e of input.equipment) app.db.run("INSERT INTO equipment (athlete_id, kind, model, role) VALUES (?,?,?,?)", athleteId, e.kind, e.model, e.role ?? null);
    if (input.health?.text) {
      app.db.run("INSERT INTO chat_note (athlete_id, kind, text, start_date, end_date, created_at) VALUES (?,?,?,?,?,?)",
        athleteId, input.health.kind, input.health.text, today, addDays(today, 7), nowIso());
    }
  });
  // History first, so Fitness and the HRV baseline start from real data.
  await syncAll(app, athleteId, 180).catch(() => undefined);
  const hrvDays = app.db.get("SELECT COUNT(*) AS n FROM wellness_day WHERE athlete_id = ? AND hrv IS NOT NULL AND date >= ?", athleteId, addDays(today, -60))?.n ?? 0;
  const learningUntil: ISODate = hrvDays >= 30 ? today : addDays(today, 14);
  app.db.run("UPDATE athlete SET learning_until = ?, onboarded = 1 WHERE id = ?", learningUntil, athleteId);
  if (app.db.get("SELECT 1 FROM training_plan WHERE athlete_id = ?", athleteId)) regenerate(app, athleteId, "onboarding");
  else ensurePlan(app, athleteId, "onboarding");
  await writeCalendar(app, athleteId, today, addDays(today, 7)).catch(() => undefined);
}

/** Demo mode: a sample athlete on simulated intervals.icu data. */
export async function seedDemo(app: App): Promise<void> {
  if (app.onboarded()) return;
  await completeOnboarding(app, {
    profile: { displayName: "Demo", weightKg: 75, heightCm: 178, ftp: 250, lthr: 162, maxHr: 184, outdoorPowerMeter: false },
    goals: [
      { role: "primary", type: "raise_ftp" },
      { role: "secondary", type: "endurance", targetDistanceKm: 150, targetMinutes: 330 },
    ],
    availability: {
      days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        available: [2, 4, 6, 7].includes(weekday),
        maxMinutes: weekday === 2 || weekday === 4 ? 60 : weekday === 6 ? 180 : weekday === 7 ? 120 : 0,
        defaultRideMode: weekday >= 6 ? "outdoor" : "indoor",
        notifyTime: "07:00",
      })),
      longRideDaysAllowed: true,
      longRideEveryWeeks: 5,
    },
    equipment: [
      { kind: "trainer", model: "Trenażer", role: "indoor_recorder" },
      { kind: "bike_computer", model: "Licznik rowerowy", role: "outdoor_master" },
      { kind: "watch", model: "Zegarek", role: "outdoor_fallback" },
    ],
  });
}
