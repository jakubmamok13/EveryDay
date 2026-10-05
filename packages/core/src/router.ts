import { addDays, mondayOf, type ISODate, type RideMode, type ScaledWorkout } from "@everyday/shared";
import { performanceSeries, powerZoneTable, SPORT_WEIGHTS, toZwo, type SportGroup } from "@everyday/engine";
import type { App } from "./app";
import { nowIso } from "./db";
import { addSnapshot, availability, goals, physiologyOn, plannedActiveOn, plannedBetween, VISIBLE, type PlannedRow } from "./repo";
import { act, reportPain, reportTravel, whyToday } from "./services/actions";
import { catchUp } from "./services/catchup";
import { addBonus, rateRide, refreshBrief, runMorning, submitCheckIn, todayView } from "./services/daily";
import { exportJson, importJson, wipe, type ExportFile } from "./services/data";
import { completeOnboarding, connectIcu, saveAvailability, saveGoals, seedDemo, type OnboardingInput } from "./services/onboarding";
import { alternatives, applyChange, confirmLongRide, ensurePlan, moveWorkout, regenerate, undo, writeCalendar } from "./services/plan";
import { countsOtherSports, recomputePerformance, syncAll } from "./services/sync";
import { whyView } from "./services/why";

// The same "API" the PWA used to call over HTTP, now an in-process router
// (D-043): the UI calls handle("POST", "/api/checkin", body) on the phone.

export class HttpError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

function bad(message: string, statusCode = 400): never {
  throw new HttpError(message, statusCode);
}

const int = (v: unknown, min: number, max: number, name: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) bad(`invalid ${name}`);
  return Math.round(n);
};
const isDate = (v: unknown): v is ISODate => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const mode = (v: unknown): RideMode => (v === "outdoor" ? "outdoor" : "indoor");

/** One-tap check-in (D-044): each button stands for a full set of answers. */
export const FEELINGS = {
  great: { label: "W pełni sił", sleepQuality: 5, legs: 5, motivation: 5 },
  good: { label: "Dobrze", sleepQuality: 4, legs: 4, motivation: 4 },
  ok: { label: "Średnio", sleepQuality: 3, legs: 3, motivation: 3 },
  worse: { label: "Czuję się gorzej", sleepQuality: 3, legs: 2, motivation: 2 },
  exhausted: { label: "Totalne wyczerpanie", sleepQuality: 2, legs: 1, motivation: 1, exhausted: true },
  sick: { label: "Choroba", sleepQuality: 2, legs: 2, motivation: 2, sick: true },
} as const;
export type Feeling = keyof typeof FEELINGS;

export const PAIN_PARTS = ["Kolano", "Plecy", "Biodro", "Kark", "Łydka / Achilles", "Inne"] as const;

/** Ride rating buttons → RPE used for the ladder (M4.6). */
const FEEL_RPE = { too_easy: 4, just_right: 6, too_hard: 8 } as const;

type Ctx = { params: Record<string, string>; body: any; query: URLSearchParams };
type Handler = (ctx: Ctx) => unknown;
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Router {
  handle(method: Method, url: string, body?: unknown): Promise<unknown>;
}

export function createRouter(app: App): Router {
  const routes: { method: Method; re: RegExp; keys: string[]; fn: Handler }[] = [];
  const on = (method: Method, path: string, fn: Handler) => {
    const keys: string[] = [];
    const re = new RegExp("^" + path.replace(/:(\w+)/g, (_, k: string) => (keys.push(k), "([^/]+)")) + "$");
    routes.push({ method, re, keys, fn });
  };
  const athlete = () => app.requireAthlete();
  const today = () => app.today();
  const calendarSoon = (id: number) => writeCalendar(app, id, today(), addDays(today(), 7)).catch(() => undefined);

  // ---------- session and onboarding ----------

  on("GET", "/api/session", () => ({ onboarded: app.onboarded(), demo: app.config.demo }));

  on("POST", "/api/onboarding/icu", async ({ body }) => {
    if (app.config.demo) return { name: "Demo", ftp: 250, lthr: 162, maxHr: 184, weightKg: 75 };
    const a = await connectIcu(app, String(body?.apiKey ?? ""), String(body?.athleteId ?? "0")).catch((e) =>
      bad(e?.code === "auth_error" ? "intervals.icu odrzuciło klucz API." : `Brak połączenia z intervals.icu: ${e.message}`),
    );
    return { name: a.name, ftp: a.ftp, lthr: a.lthr, maxHr: a.maxHr, weightKg: a.weightKg };
  });

  on("POST", "/api/onboarding/complete", async ({ body }) => {
    const b = body as OnboardingInput;
    if (!b?.profile || !b.goals?.length || !b.availability?.days?.length) bad("Brak danych onboardingu.");
    int(b.profile.ftp, 50, 600, "ftp");
    int(b.profile.weightKg, 30, 250, "weight");
    await completeOnboarding(app, b);
    return { ok: true };
  });

  on("POST", "/api/demo/seed", async () => {
    if (!app.config.demo) bad("Tylko w trybie demo.");
    await seedDemo(app);
    return { ok: true };
  });

  on("POST", "/api/catchup", async () => ({ ran: await catchUp(app) }));

  // ---------- today ----------

  on("GET", "/api/today", () => {
    const id = athlete();
    app.db.run("UPDATE daily_brief SET opened_at = COALESCE(opened_at, ?) WHERE athlete_id = ? AND date = ? AND opened_at IS NULL", nowIso(), id, today());
    return todayView(app, id);
  });

  on("GET", "/api/today/why", () => whyView(app, athlete()));

  on("POST", "/api/checkin", async ({ body }) => {
    const id = athlete();
    const f = FEELINGS[body?.feeling as Feeling] ?? bad("invalid feeling");
    const part = body?.painPart ? String(body.painPart).slice(0, 40) : null;
    await submitCheckIn(app, id, {
      sleepQuality: f.sleepQuality,
      legs: f.legs,
      motivation: f.motivation,
      sick: "sick" in f,
      exhausted: "exhausted" in f,
      feeling: body.feeling,
      pain: !!part,
      ...(part ? { painNote: `Ból: ${part}` } : {}),
      rideMode: mode(body?.rideMode),
    });
    return todayView(app, id);
  });

  on("POST", "/api/checkin/skip", async () => {
    const id = athlete();
    await runMorning(app, id, today(), false);
    return todayView(app, id);
  });

  on("POST", "/api/adaptations/:id/undo", async ({ params }) => {
    const id = athlete();
    if (!undo(app, id, Number(params.id))) bad("Nie ma takiej zmiany.", 404);
    await refreshBrief(app, id, today());
    await calendarSoon(id);
    return todayView(app, id);
  });

  on("POST", "/api/rides/:id/rating", ({ params, body }) => {
    const id = athlete();
    const feel = body?.feel as keyof typeof FEEL_RPE;
    if (!(feel in FEEL_RPE)) bad("invalid feel");
    rateRide(app, id, Number(params.id), body?.rpe ? int(body.rpe, 1, 10, "rpe") : FEEL_RPE[feel], feel);
    return todayView(app, id);
  });

  on("POST", "/api/bonus", async ({ body }) => {
    const id = athlete();
    await addBonus(app, id, int(body?.minutes, 20, 300, "minutes"), mode(body?.rideMode));
    await calendarSoon(id);
    return todayView(app, id);
  });

  on("GET", "/api/planned/:id/zwo", ({ params }) => {
    const row = app.db.get<PlannedRow>("SELECT * FROM planned_workout WHERE id = ? AND athlete_id = ?", Number(params.id), athlete());
    if (!row) bad("not found", 404);
    const w = JSON.parse(row.workout_json) as ScaledWorkout;
    return { filename: `${w.slug}-${row.date}.zwo`, type: "application/xml", content: toZwo(w) };
  });

  // ---------- quick actions (buttons instead of chat, D-044) ----------

  on("GET", "/api/actions", () => {
    const id = athlete();
    const row = plannedActiveOn(app, id, today());
    return {
      today: row && row.status === "planned" ? { name: JSON.parse(row.workout_json).name, minutes: JSON.parse(row.workout_json).minutes } : null,
      why: whyToday(app, id),
      notes: app.db.all("SELECT id, kind, text, start_date, end_date FROM chat_note WHERE athlete_id = ? AND deleted_at IS NULL AND end_date >= ? ORDER BY start_date, id", id, today()),
      painParts: PAIN_PARTS,
    };
  });

  const done = async (r: { ok: boolean; text: string; adaptationId?: number } | { ok: boolean; text: string }[]) => {
    const list = Array.isArray(r) ? r : [r];
    await calendarSoon(athlete());
    return { ok: list.some((x) => x.ok), messages: list.map((x) => x.text) };
  };

  on("POST", "/api/actions/shorten", async ({ body }) =>
    done(await act(app, athlete(), { type: "shorten", date: today(), minutes: int(body?.minutes, 15, 600, "minutes") })));
  on("POST", "/api/actions/easier", async () => done(await act(app, athlete(), { type: "easier", date: today() })));
  on("POST", "/api/actions/rest", async () => done(await act(app, athlete(), { type: "rest", date: today() })));
  on("POST", "/api/actions/tomorrow", async () =>
    done(await act(app, athlete(), { type: "move", date: today(), toDate: addDays(today(), 1) })));
  on("POST", "/api/actions/pain", async ({ body }) => {
    const part = String(body?.part ?? "").slice(0, 40);
    if (!part) bad("invalid part");
    return done(await reportPain(app, athlete(), part));
  });
  on("POST", "/api/actions/travel", async ({ body }) => {
    const from = isDate(body?.fromDate) && body.fromDate >= today() ? body.fromDate : today();
    return done(await reportTravel(app, athlete(), from, int(body?.days, 1, 30, "days")));
  });

  on("DELETE", "/api/notes/:id", async ({ params }) => {
    const id = athlete();
    app.db.run("UPDATE chat_note SET deleted_at = ? WHERE id = ? AND athlete_id = ?", nowIso(), Number(params.id), id);
    await refreshBrief(app, id, today());
    return { ok: true };
  });

  // ---------- week ----------

  on("GET", "/api/week", ({ query }) => {
    const id = athlete();
    const q = query.get("start");
    const start = isDate(q) ? mondayOf(q) : mondayOf(today());
    const end = addDays(start, 6);
    const rows = plannedBetween(app, id, start, end, VISIBLE);
    const week = app.db.get("SELECT pw.* FROM plan_week pw JOIN training_plan tp ON tp.id = pw.plan_id WHERE tp.athlete_id = ? AND tp.status = 'active' AND pw.week_start = ?", id, start);
    const acts = app.db.all("SELECT id, date, name, moving_seconds, load, is_master, duplicate_of, planned_workout_id, compliance_pct, source_device, sport FROM activity WHERE athlete_id = ? AND date BETWEEN ? AND ? ORDER BY start_at", id, start, end);
    return {
      start,
      today: today(),
      kind: week?.kind ?? null,
      focus: week?.focus ?? null,
      targetLoad: week?.target_load ?? null,
      days: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return {
          date,
          workouts: rows.filter((r) => r.date === date).map((r) => {
            const w = JSON.parse(r.workout_json) as ScaledWorkout;
            return { id: r.id, name: w.name, minutes: w.minutes, load: w.load, category: w.category, intensity: w.intensity, isKey: !!r.is_key, role: r.role, status: r.status, rideMode: r.ride_mode, deliveryStatus: r.delivery_status };
          }),
          rides: acts.filter((a) => a.date === date).map((a) => ({ id: a.id, name: a.name, minutes: Math.round(a.moving_seconds / 60), load: a.load, duplicate: !a.is_master, compliance: a.compliance_pct, source: a.source_device, sport: a.sport, sportLabel: a.sport === "ride" ? null : SPORT_WEIGHTS[a.sport as SportGroup]?.label ?? "inny sport" })),
        };
      }),
      longRide: app.db.get("SELECT id, proposed_date, minutes FROM long_ride_proposal WHERE athlete_id = ? AND status = 'proposed'", id) ?? null,
      ftpSuggestion: app.db.get("SELECT id, current_ftp, suggested_ftp, basis FROM ftp_suggestion WHERE athlete_id = ? AND status = 'pending'", id) ?? null,
    };
  });

  const ownedRow = (rowId: number): PlannedRow => {
    const row = app.db.get<PlannedRow>("SELECT * FROM planned_workout WHERE id = ? AND athlete_id = ? AND status = 'planned'", rowId, athlete());
    if (!row) bad("Nie ma takiego treningu do zmiany.", 404);
    return row;
  };

  on("POST", "/api/planned/:id/move", async ({ params, body }) => {
    const row = ownedRow(Number(params.id));
    const to = body?.toDate;
    if (!isDate(to) || to < today()) bad("invalid date");
    const id = athlete();
    moveWorkout(app, id, row, to, "manual", ["manual"], `przeniesiony na ${to}`);
    if (row.date === today() || to === today()) await refreshBrief(app, id, today());
    await calendarSoon(id);
    const near = plannedBetween(app, id, addDays(to, -1), addDays(to, 1));
    const hard = near.filter((r) => JSON.parse(r.workout_json).intensity === "hard").length;
    return { ok: true, warning: hard >= 2 ? "Uwaga: dwa mocne dni z rzędu." : null };
  });

  on("POST", "/api/planned/:id/skip", async ({ params }) => {
    const row = ownedRow(Number(params.id));
    const id = athlete();
    applyChange(app, id, row, null, "manual", "rest", ["manual"], `pominięty „${JSON.parse(row.workout_json).name}”`);
    if (row.date === today()) await refreshBrief(app, id, row.date);
    await calendarSoon(id);
    return { ok: true };
  });

  on("POST", "/api/planned/:id/restore", async ({ params }) => {
    const id = athlete();
    const row = app.db.get<PlannedRow>("SELECT * FROM planned_workout WHERE id = ? AND athlete_id = ? AND status = 'skipped'", Number(params.id), id);
    if (!row || row.date < today()) bad("Tego treningu nie da się przywrócić.", 404);
    const a = app.db.get<{ id: number }>(
      "SELECT id FROM adaptation WHERE athlete_id = ? AND planned_workout_id = ? AND action = 'rest' AND undone_at IS NULL ORDER BY id DESC LIMIT 1", id, row.id,
    );
    if (!a || !undo(app, id, a.id)) bad("Tego treningu nie da się przywrócić.", 404);
    if (row.date === today()) await refreshBrief(app, id, today());
    await calendarSoon(id);
    return { ok: true };
  });

  on("GET", "/api/planned/:id/alternatives", ({ params }) =>
    alternatives(ownedRow(Number(params.id))).map((w) => ({ slug: w.slug, name: w.name, minutes: w.minutes, load: w.load })));

  on("POST", "/api/planned/:id/swap", async ({ params, body }) => {
    const row = ownedRow(Number(params.id));
    const alt = alternatives(row).find((w) => w.slug === body?.slug) ?? bad("Ten trening nie jest zamiennikiem.");
    const id = athlete();
    applyChange(app, id, row, alt, "manual", "swap_workout", ["manual"], `zamiana na „${alt.name}”`);
    if (row.date === today()) await refreshBrief(app, id, row.date);
    await calendarSoon(id);
    return { ok: true };
  });

  on("POST", "/api/long-ride/:id", async ({ params, body }) => {
    const id = athlete();
    confirmLongRide(app, id, Number(params.id), !!body?.confirm);
    if (body?.confirm) ensurePlan(app, id);
    await calendarSoon(id);
    return { ok: true };
  });

  on("POST", "/api/ftp-suggestion/:id", ({ params, body }) => {
    const id = athlete();
    const s = app.db.get("SELECT * FROM ftp_suggestion WHERE id = ? AND athlete_id = ? AND status = 'pending'", Number(params.id), id) ?? bad("not found", 404);
    const ftp = body?.ftp ? int(body.ftp, 50, 600, "ftp") : s.suggested_ftp;
    if (body?.accept && ftp > 0) addSnapshot(app, id, today(), { ftp }, s.basis === "eftp" ? "eftp_accepted" : s.basis);
    app.db.run("UPDATE ftp_suggestion SET status = ?, decided_at = ? WHERE id = ?", body?.accept ? "accepted" : "rejected", nowIso(), s.id);
    return { ok: true };
  });

  // ---------- progress (R8-18) ----------

  on("GET", "/api/progress", () => {
    const id = athlete();
    const t = today();
    const series = app.db.all("SELECT date, fitness, fatigue, form, load FROM daily_state WHERE athlete_id = ? AND date BETWEEN ? AND ? ORDER BY date", id, addDays(t, -90), t);
    const last = series[series.length - 1];
    const planned = plannedBetween(app, id, addDays(t, 1), addDays(t, 28));
    const loads = new Map<ISODate, number>();
    for (const r of planned) loads.set(r.date, (loads.get(r.date) ?? 0) + JSON.parse(r.workout_json).load);
    const projection = last ? performanceSeries(loads, addDays(t, 1), addDays(t, 28), { fitness: last.fitness, fatigue: last.fatigue }) : [];
    const snaps = app.db.all("SELECT effective_from AS date, ftp_w AS ftp, weight_kg AS weight, source FROM fitness_snapshot WHERE athlete_id = ? ORDER BY effective_from, id", id);
    const longest = app.db.get("SELECT date, moving_seconds, distance_m FROM activity WHERE athlete_id = ? AND sport = 'ride' AND is_master = 1 ORDER BY moving_seconds DESC LIMIT 1", id);
    const target = goals(app, id).find((g) => g.type === "endurance");
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = addDays(mondayOf(t), -7 * (11 - i));
      const end = addDays(start, 6);
      const rows = app.db.all(`SELECT status, workout_json FROM planned_workout WHERE athlete_id = ? AND date BETWEEN ? AND ? AND date < ? AND status IN ('completed','partial','missed','skipped','planned')`, id, start, end, t);
      const doneCount = rows.filter((r) => r.status === "completed" || r.status === "partial").length;
      const load = app.db.get("SELECT SUM(load) AS l FROM activity WHERE athlete_id = ? AND sport = 'ride' AND is_master = 1 AND date BETWEEN ? AND ?", id, start, end)?.l ?? 0;
      const plannedLoad = rows.reduce((s, r) => s + JSON.parse(r.workout_json).load, 0);
      return { start, planned: rows.length, done: doneCount, load: Math.round(load), plannedLoad: Math.round(plannedLoad) };
    });
    const phys = physiologyOn(app, id, t);
    return {
      series: series.map((s) => ({ date: s.date, fitness: s.fitness, fatigue: s.fatigue, form: s.form })),
      projection: projection.map((p) => ({ date: p.date, fitness: p.fitness, fatigue: p.fatigue, form: p.form })),
      ftp: snaps.map((s) => ({ date: s.date < addDays(t, -365) ? null : s.date, ftp: s.ftp, wkg: s.weight ? Math.round((s.ftp / s.weight) * 100) / 100 : null, source: s.source })),
      current: { ftp: phys.ftp, wkg: phys.weightKg ? Math.round((phys.ftp / phys.weightKg) * 100) / 100 : null, zones: powerZoneTable(phys.ftp) },
      longRide: {
        longestMinutes: longest ? Math.round(longest.moving_seconds / 60) : 0,
        longestKm: longest?.distance_m ? Math.round(longest.distance_m / 1000) : 0,
        longestDate: longest?.date ?? null,
        targetMinutes: target?.targetMinutes ?? null,
        targetKm: target?.targetDistanceKm ?? null,
        milestones: [240, 300, 360, 420],
      },
      weeks,
    };
  });

  // ---------- settings ----------

  on("GET", "/api/settings", () => {
    const id = athlete();
    const ath = app.db.get("SELECT * FROM athlete WHERE id = ?", id) ?? {};
    const conn = app.db.get("SELECT external_athlete_id, status, last_sync_at, last_error, api_key_encrypted IS NOT NULL AS has_key FROM source_connection WHERE athlete_id = ?", id);
    return {
      profile: { ...physiologyOn(app, id, today()), heightCm: ath.height_cm, displayName: ath.display_name, outdoorPowerMeter: !!ath.outdoor_power_meter },
      goals: goals(app, id),
      availability: availability(app, id),
      equipment: app.db.all("SELECT kind, model, role FROM equipment WHERE athlete_id = ? AND active = 1", id),
      connection: conn ? { athleteId: conn.external_athlete_id, status: conn.status, lastSyncAt: conn.last_sync_at, error: conn.last_error, hasKey: !!conn.has_key } : null,
      reminder: app.setting("reminder", { time: "07:00" }),
      otherSports: countsOtherSports(app),
      demo: app.config.demo,
    };
  });

  on("PUT", "/api/settings/profile", async ({ body }) => {
    const id = athlete();
    const b: any = body ?? {};
    const cur = physiologyOn(app, id, today());
    const next = {
      ftp: b.ftp !== undefined ? int(b.ftp, 50, 600, "ftp") : cur.ftp,
      lthr: b.lthr ? int(b.lthr, 80, 220, "lthr") : cur.lthr,
      maxHr: b.maxHr ? int(b.maxHr, 100, 240, "maxHr") : cur.maxHr,
      weightKg: b.weightKg ? Number(b.weightKg) : cur.weightKg,
    };
    if (JSON.stringify(next) !== JSON.stringify(cur)) {
      addSnapshot(app, id, today(), next, "manual");
      await refreshBrief(app, id, today());
    }
    app.db.run("UPDATE athlete SET height_cm = COALESCE(?, height_cm), outdoor_power_meter = COALESCE(?, outdoor_power_meter), display_name = COALESCE(?, display_name) WHERE id = ?",
      b.heightCm ?? null, b.outdoorPowerMeter === undefined ? null : b.outdoorPowerMeter ? 1 : 0, b.displayName ?? null, id);
    return { ok: true };
  });

  on("PUT", "/api/settings/goals", async ({ body }) => {
    const id = athlete();
    if (!Array.isArray(body?.goals) || !body.goals.some((g: any) => g.role === "primary")) bad("Potrzebny jest cel główny.");
    saveGoals(app, id, body.goals);
    regenerate(app, id, "goal_change");
    await calendarSoon(id);
    return { ok: true };
  });

  on("PUT", "/api/settings/availability", async ({ body }) => {
    const id = athlete();
    const b = body as OnboardingInput["availability"];
    if (!Array.isArray(b?.days) || b.days.length !== 7) bad("Potrzebne 7 dni.");
    const before = availability(app, id);
    saveAvailability(app, id, b);
    const trainingChanged = JSON.stringify(before.days.map((d) => [d.available, d.maxMinutes])) !== JSON.stringify(b.days.map((d) => [d.available, d.available ? d.maxMinutes : 0]));
    if (trainingChanged) {
      regenerate(app, id, "availability_change");
      await calendarSoon(id);
    }
    return { ok: true, regenerated: trainingChanged };
  });

  on("PUT", "/api/settings/reminder", ({ body }) => {
    const time = String(body?.time ?? "");
    if (!/^\d{2}:\d{2}$/.test(time)) bad("invalid time");
    app.setSetting("reminder", { time });
    return { ok: true };
  });

  on("PUT", "/api/settings/other-sports", async ({ body }) => {
    const id = athlete();
    app.setSetting("otherSports", { enabled: !!body?.enabled });
    recomputePerformance(app, id);
    await refreshBrief(app, id, today());
    return { ok: true };
  });

  on("PUT", "/api/settings/icu", async ({ body }) => {
    if (app.config.demo) bad("W trybie demo nie ma połączenia z intervals.icu.");
    await connectIcu(app, String(body?.apiKey ?? ""), String(body?.athleteId ?? "0")).catch((e) =>
      bad(e?.code === "auth_error" ? "intervals.icu odrzuciło klucz API." : `Brak połączenia z intervals.icu: ${e.message}`),
    );
    return { ok: true };
  });

  on("POST", "/api/plan/regenerate", async () => {
    const id = athlete();
    regenerate(app, id, "manual_regen");
    await calendarSoon(id);
    return { ok: true };
  });

  on("POST", "/api/sync", async () => {
    const id = athlete();
    const r = await syncAll(app, id, 14).catch((e) => bad(`Synchronizacja nie powiodła się: ${e.message}`, 502));
    const cal = await writeCalendar(app, id, addDays(today(), -1), addDays(today(), 7)).catch(() => ({ written: 0, failed: 0 }));
    return { ...r, ...cal };
  });

  // ---------- data ----------

  on("GET", "/api/export", () => exportJson(app));

  on("POST", "/api/import", ({ body }) => {
    importJson(app, body as ExportFile);
    return { ok: true };
  });

  on("POST", "/api/wipe", ({ body }) => {
    if (body?.confirm !== "USUŃ") bad("Wpisz USUŃ, aby potwierdzić.");
    wipe(app);
    return { ok: true };
  });

  on("GET", "/api/status", () => {
    const id = app.onboarded() ? app.athleteId() : null;
    const lastJob = (job: string) => app.db.get("SELECT started_at, finished_at, status, error_code FROM job_run WHERE job = ? ORDER BY id DESC LIMIT 1", job) ?? null;
    const lastSync = Number(app.db.meta("last_day_sync") || 0);
    return {
      now: app.now(),
      night: lastJob("night"),
      lastCatchUp: lastSync ? new Date(lastSync).toISOString() : null,
      connection: id ? app.db.get("SELECT status, last_sync_at, last_error FROM source_connection WHERE athlete_id = ?", id) ?? null : null,
      counts: id ? {
        activities: app.db.get("SELECT COUNT(*) AS n FROM activity WHERE athlete_id = ?", id)?.n ?? 0,
        wellnessDays: app.db.get("SELECT COUNT(*) AS n FROM wellness_day WHERE athlete_id = ?", id)?.n ?? 0,
      } : null,
      notes: app.config.notes.length,
      timeZone: app.config.timeZone,
      demo: app.config.demo,
    };
  });

  return {
    async handle(method, url, body) {
      const [path, qs] = url.split("?") as [string, string | undefined];
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]));
        return await r.fn({ params, body: body ?? {}, query: new URLSearchParams(qs ?? "") });
      }
      bad(`no route ${method} ${path}`, 404);
    },
  };
}
