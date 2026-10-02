import { addDays, type AvailabilityDay, type Goal, type ISODate } from "@everyday/shared";
import type { App } from "../app";
import { nowIso } from "../db";
import { RealIcuClient } from "../icu";
import { hashPassword } from "../secrets";
import { syncKnowledge } from "./coach";
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

export function createAccount(app: App, email: string, password: string): number {
  if (app.accountId()) throw Object.assign(new Error("account exists"), { statusCode: 409 });
  return app.db.tx(() => {
    const acc = app.db.run("INSERT INTO account (email, password_hash, created_at) VALUES (?,?,?)", email.trim().toLowerCase(), hashPassword(password), nowIso()).id;
    app.db.run("INSERT INTO athlete (account_id, created_at) VALUES (?,?)", acc, nowIso());
    return acc;
  });
}

/** Test the intervals.icu key and store it encrypted; returns pre-fill values (R8-04). */
export async function connectIcu(app: App, apiKey: string, externalId = "0") {
  const athleteId = app.requireAthlete();
  const client = new RealIcuClient(apiKey.trim(), externalId || "0");
  const a = await client.athlete();
  app.db.run(
    `INSERT INTO source_connection (athlete_id, provider, external_athlete_id, api_key_encrypted, status) VALUES (?,?,?,?,'ok')
     ON CONFLICT(athlete_id, provider) DO UPDATE SET external_athlete_id = excluded.external_athlete_id, api_key_encrypted = excluded.api_key_encrypted, status = 'ok'`,
    athleteId, "intervals_icu", a.id, app.secrets.seal(apiKey.trim()),
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
  syncKnowledge(app);
  await writeCalendar(app, athleteId, today, addDays(today, 7)).catch(() => undefined);
}

/** Demo mode: the author's profile (01 §4) on simulated intervals.icu data. */
export async function seedDemo(app: App): Promise<void> {
  if (app.accountId()) return;
  createAccount(app, "demo@everyday.local", "demo1234");
  await completeOnboarding(app, {
    profile: { displayName: "Kuba", weightKg: 86, heightCm: 174, ftp: 270, lthr: 165, maxHr: 186, outdoorPowerMeter: false },
    goals: [
      { role: "primary", type: "raise_ftp" },
      { role: "secondary", type: "endurance", targetDistanceKm: 200, targetMinutes: 420 },
    ],
    availability: {
      days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        available: [1, 3, 6, 7].includes(weekday),
        maxMinutes: weekday === 1 || weekday === 3 ? 60 : weekday >= 6 ? 240 : 0,
        defaultRideMode: weekday >= 6 ? "outdoor" : "indoor",
        notifyTime: "07:00",
      })),
      longRideDaysAllowed: true,
      longRideEveryWeeks: 5,
    },
    equipment: [
      { kind: "trainer", model: "Wahoo KICKR CORE", role: "indoor_recorder" },
      { kind: "bike_computer", model: "Wahoo ELEMNT BOLT v2", role: "outdoor_master" },
      { kind: "watch", model: "Garmin Fenix 8", role: "outdoor_fallback" },
      { kind: "hr_strap", model: "Pas HR", role: null },
    ],
  });
}
