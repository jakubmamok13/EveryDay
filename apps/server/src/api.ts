import { existsSync, readFileSync, statfsSync, statSync } from "node:fs";
import { join } from "node:path";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { addDays, mondayOf, type ISODate, type RideMode, type ScaledWorkout } from "@everyday/shared";
import { performanceSeries, powerZoneTable, toZwo } from "@everyday/engine";
import type { App } from "./app";
import { nowIso } from "./db";
import { addSnapshot, availability, goals, physiologyOn, plannedActiveOn, plannedBetween, VISIBLE, type PlannedRow } from "./repo";
import { hashToken, newToken, verifyPassword } from "./secrets";
import { applyAction, chat } from "./services/coach";
import { addBonus, rateRide, refreshBrief, submitCheckIn, todayView } from "./services/daily";
import { deleteAccount, exportZip } from "./services/data";
import { completeOnboarding, connectIcu, createAccount, saveAvailability, saveGoals, type OnboardingInput } from "./services/onboarding";
import { alternatives, applyChange, confirmLongRide, ensurePlan, moveWorkout, regenerate, undo, writeCalendar } from "./services/plan";
import { sendToAll, vapid } from "./services/push";
import { syncAll } from "./services/sync";

const COOKIE = "ed_session";
const PUBLIC = new Set(["/api/session", "/api/setup", "/api/login", "/api/health"]);

function bad(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

const int = (v: unknown, min: number, max: number, name: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) bad(`invalid ${name}`);
  return Math.round(n);
};
const isDate = (v: unknown): v is ISODate => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const mode = (v: unknown): RideMode => (v === "outdoor" ? "outdoor" : "indoor");

export async function buildServer(app: App) {
  const f = Fastify({ logger: false, trustProxy: "127.0.0.1", bodyLimit: 1_000_000 });
  await f.register(cookie);

  // ---------- auth ----------

  const sessionAccount = (req: FastifyRequest): number | null => {
    const token = req.cookies[COOKIE];
    if (!token) return null;
    const s = app.db.get("SELECT id, account_id FROM device_session WHERE token_hash = ? AND revoked_at IS NULL", hashToken(token));
    if (!s) return null;
    app.db.run("UPDATE device_session SET last_seen_at = ? WHERE id = ?", nowIso(), s.id);
    return s.account_id;
  };

  const startSession = (reply: FastifyReply, accountId: number, device: string, remember: boolean) => {
    const token = newToken();
    app.db.run("INSERT INTO device_session (account_id, device_name, token_hash, remember, created_at) VALUES (?,?,?,?,?)",
      accountId, device.slice(0, 120), hashToken(token), remember ? 1 : 0, nowIso());
    reply.setCookie(COOKIE, token, {
      path: "/", httpOnly: true, sameSite: "strict", secure: "auto",
      ...(remember ? { maxAge: 400 * 86_400 } : {}),
    });
  };

  f.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/api/") || PUBLIC.has(req.url.split("?")[0]!)) return;
    let acc = sessionAccount(req);
    if (!acc && app.config.demo && app.accountId()) {
      acc = app.accountId()!;
      startSession(reply, acc, "demo", true);
    }
    if (!acc) return reply.code(401).send({ error: "unauthorized" });
  });

  f.setErrorHandler((err: any, _req, reply) => {
    const code = err.statusCode && err.statusCode < 600 ? err.statusCode : 500;
    if (code >= 500) console.error("[api]", err.message);
    reply.code(code).send({ error: err.message });
  });

  f.get("/api/health", async () => ({ ok: true }));

  f.get("/api/session", async (req, reply) => {
    let acc = sessionAccount(req);
    if (!acc && app.config.demo && app.accountId()) {
      acc = app.accountId()!;
      startSession(reply, acc, "demo", true);
    }
    const athlete = app.athleteId();
    return {
      needsSetup: !app.accountId(),
      authenticated: !!acc,
      onboarded: !!(athlete && app.db.get("SELECT onboarded FROM athlete WHERE id = ?", athlete)?.onboarded),
      demo: app.config.demo,
    };
  });

  f.post<{ Body: { email: string; password: string } }>("/api/setup", async (req, reply) => {
    const { email, password } = req.body ?? ({} as any);
    if (!/^\S+@\S+$/.test(email ?? "") || (password ?? "").length < 8) bad("Podaj e-mail i hasło (min. 8 znaków).");
    const acc = createAccount(app, email, password);
    startSession(reply, acc, String(req.headers["user-agent"] ?? "device"), true);
    return { ok: true };
  });

  f.post<{ Body: { email: string; password: string; remember?: boolean } }>("/api/login", async (req, reply) => {
    const { email, password, remember } = req.body ?? ({} as any);
    const acc = app.db.get("SELECT id, password_hash FROM account WHERE email = ?", String(email ?? "").trim().toLowerCase());
    if (!acc || !verifyPassword(String(password ?? ""), acc.password_hash)) bad("Błędny e-mail lub hasło.", 401);
    startSession(reply, acc.id, String(req.headers["user-agent"] ?? "device"), remember !== false);
    return { ok: true };
  });

  f.post("/api/logout", async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) app.db.run("UPDATE device_session SET revoked_at = ? WHERE token_hash = ?", nowIso(), hashToken(token));
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  // ---------- onboarding ----------

  f.post<{ Body: { apiKey: string; athleteId?: string } }>("/api/onboarding/icu", async (req) => {
    if (app.config.demo) return { name: "Demo", ftp: 270, lthr: 165, maxHr: 186, weightKg: 86 };
    const a = await connectIcu(app, String(req.body?.apiKey ?? ""), String(req.body?.athleteId ?? "0")).catch((e) =>
      bad(e?.code === "auth_error" ? "intervals.icu odrzuciło klucz API." : `Brak połączenia z intervals.icu: ${e.message}`, 400),
    );
    return { name: a.name, ftp: a.ftp, lthr: a.lthr, maxHr: a.maxHr, weightKg: a.weightKg };
  });

  f.post<{ Body: OnboardingInput }>("/api/onboarding/complete", async (req) => {
    const b = req.body;
    if (!b?.profile || !b.goals?.length || !b.availability?.days?.length) bad("Brak danych onboardingu.");
    int(b.profile.ftp, 50, 600, "ftp");
    int(b.profile.weightKg, 30, 250, "weight");
    await completeOnboarding(app, b);
    return { ok: true };
  });

  // ---------- today ----------

  f.get("/api/today", async () => {
    const id = app.requireAthlete();
    app.db.run("UPDATE daily_brief SET opened_at = COALESCE(opened_at, ?) WHERE athlete_id = ? AND date = ?", nowIso(), id, app.today());
    return todayView(app, id);
  });

  f.post<{ Body: any }>("/api/checkin", async (req) => {
    const b: any = req.body ?? {};
    const id = app.requireAthlete();
    await submitCheckIn(app, id, {
      sleepQuality: int(b.sleepQuality, 1, 5, "sleepQuality"),
      legs: int(b.legs, 1, 5, "legs"),
      motivation: int(b.motivation, 1, 5, "motivation"),
      sick: !!b.sick,
      pain: !!b.pain,
      ...(b.painNote ? { painNote: String(b.painNote).slice(0, 200) } : {}),
      rideMode: mode(b.rideMode),
    });
    return todayView(app, id);
  });

  f.post<{ Params: { id: string } }>("/api/adaptations/:id/undo", async (req) => {
    const id = app.requireAthlete();
    if (!undo(app, id, Number(req.params.id))) bad("Nie ma takiej zmiany.", 404);
    await refreshBrief(app, id, app.today());
    await writeCalendar(app, id, app.today(), addDays(app.today(), 7)).catch(() => undefined);
    return todayView(app, id);
  });

  f.post<{ Params: { id: string }; Body: { rpe: number; feel: string } }>("/api/rides/:id/rating", async (req) => {
    const id = app.requireAthlete();
    const feel = req.body?.feel;
    if (!["too_easy", "just_right", "too_hard"].includes(feel)) bad("invalid feel");
    rateRide(app, id, Number(req.params.id), int(req.body?.rpe, 1, 10, "rpe"), feel);
    return todayView(app, id);
  });

  f.post<{ Body: { minutes: number } }>("/api/today/minutes", async (req) => {
    const id = app.requireAthlete();
    const r = applyAction(app, id, { type: "shorten", date: app.today(), minutes: int(req.body?.minutes, 15, 600, "minutes") }, "manual");
    if (!r.ok) bad(r.text);
    await refreshBrief(app, id, app.today());
    return todayView(app, id);
  });

  f.post<{ Body: { minutes: number; rideMode?: string } }>("/api/bonus", async (req) => {
    const id = app.requireAthlete();
    await addBonus(app, id, int(req.body?.minutes, 20, 300, "minutes"), mode(req.body?.rideMode));
    return todayView(app, id);
  });

  f.get<{ Params: { id: string } }>("/api/planned/:id/zwo", async (req, reply) => {
    const id = app.requireAthlete();
    const row = app.db.get<PlannedRow>("SELECT * FROM planned_workout WHERE id = ? AND athlete_id = ?", Number(req.params.id), id);
    if (!row) bad("not found", 404);
    const w = JSON.parse(row.workout_json) as ScaledWorkout;
    reply.header("content-type", "application/xml").header("content-disposition", `attachment; filename="${w.slug}-${row.date}.zwo"`);
    return toZwo(w);
  });

  // ---------- week ----------

  f.get<{ Querystring: { start?: string } }>("/api/week", async (req) => {
    const id = app.requireAthlete();
    const start = isDate(req.query.start) ? mondayOf(req.query.start) : mondayOf(app.today());
    const end = addDays(start, 6);
    const rows = plannedBetween(app, id, start, end, VISIBLE);
    const week = app.db.get("SELECT pw.* FROM plan_week pw JOIN training_plan tp ON tp.id = pw.plan_id WHERE tp.athlete_id = ? AND tp.status = 'active' AND pw.week_start = ?", id, start);
    const acts = app.db.all("SELECT id, date, name, moving_seconds, load, is_master, duplicate_of, planned_workout_id, compliance_pct, source_device FROM activity WHERE athlete_id = ? AND date BETWEEN ? AND ? ORDER BY start_at", id, start, end);
    return {
      start,
      today: app.today(),
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
          rides: acts.filter((a) => a.date === date).map((a) => ({ id: a.id, name: a.name, minutes: Math.round(a.moving_seconds / 60), load: a.load, duplicate: !a.is_master, compliance: a.compliance_pct, source: a.source_device })),
        };
      }),
      longRide: app.db.get("SELECT id, proposed_date, minutes FROM long_ride_proposal WHERE athlete_id = ? AND status = 'proposed'", id) ?? null,
      ftpSuggestion: app.db.get("SELECT id, current_ftp, suggested_ftp, basis FROM ftp_suggestion WHERE athlete_id = ? AND status = 'pending'", id) ?? null,
    };
  });

  const ownedRow = (rowId: number): PlannedRow => {
    const id = app.requireAthlete();
    const row = app.db.get<PlannedRow>("SELECT * FROM planned_workout WHERE id = ? AND athlete_id = ? AND status = 'planned'", rowId, id);
    if (!row) bad("Nie ma takiego treningu do zmiany.", 404);
    return row;
  };

  f.post<{ Params: { id: string }; Body: { toDate: string } }>("/api/planned/:id/move", async (req) => {
    const row = ownedRow(Number(req.params.id));
    if (!isDate(req.body?.toDate) || req.body.toDate < app.today()) bad("invalid date");
    const id = app.requireAthlete();
    moveWorkout(app, id, row, req.body.toDate, "manual", ["manual"], `przeniesiony na ${req.body.toDate}`);
    if (row.date === app.today() || req.body.toDate === app.today()) await refreshBrief(app, id, app.today());
    const after = plannedBetween(app, id, addDays(req.body.toDate, -1), addDays(req.body.toDate, 1));
    const hard = after.filter((r) => JSON.parse(r.workout_json).intensity === "hard").length;
    return { ok: true, warning: hard >= 2 ? "Uwaga: dwa mocne dni z rzędu." : null };
  });

  f.post<{ Params: { id: string } }>("/api/planned/:id/skip", async (req) => {
    const row = ownedRow(Number(req.params.id));
    applyChange(app, app.requireAthlete(), row, null, "manual", "rest", ["manual"], `pominięty „${JSON.parse(row.workout_json).name}”`);
    if (row.date === app.today()) await refreshBrief(app, app.requireAthlete(), row.date);
    return { ok: true };
  });

  f.get<{ Params: { id: string } }>("/api/planned/:id/alternatives", async (req) => {
    return alternatives(ownedRow(Number(req.params.id))).map((w) => ({ slug: w.slug, name: w.name, minutes: w.minutes, load: w.load }));
  });

  f.post<{ Params: { id: string }; Body: { slug: string } }>("/api/planned/:id/swap", async (req) => {
    const row = ownedRow(Number(req.params.id));
    const alt = alternatives(row).find((w) => w.slug === req.body?.slug);
    if (!alt) bad("Ten trening nie jest zamiennikiem.");
    applyChange(app, app.requireAthlete(), row, alt, "manual", "swap_workout", ["manual"], `zamiana na „${alt.name}”`);
    if (row.date === app.today()) await refreshBrief(app, app.requireAthlete(), row.date);
    return { ok: true };
  });

  f.post<{ Params: { id: string }; Body: { confirm: boolean } }>("/api/long-ride/:id", async (req) => {
    const id = app.requireAthlete();
    confirmLongRide(app, id, Number(req.params.id), !!req.body?.confirm);
    if (req.body?.confirm) ensurePlan(app, id);
    return { ok: true };
  });

  f.post<{ Params: { id: string }; Body: { accept: boolean; ftp?: number } }>("/api/ftp-suggestion/:id", async (req) => {
    const id = app.requireAthlete();
    const s = app.db.get("SELECT * FROM ftp_suggestion WHERE id = ? AND athlete_id = ? AND status = 'pending'", Number(req.params.id), id);
    if (!s) bad("not found", 404);
    const ftp = req.body?.ftp ? int(req.body.ftp, 50, 600, "ftp") : s.suggested_ftp;
    if (req.body?.accept && ftp > 0) addSnapshot(app, id, app.today(), { ftp }, s.basis === "eftp" ? "eftp_accepted" : s.basis);
    app.db.run("UPDATE ftp_suggestion SET status = ?, decided_at = ? WHERE id = ?", req.body?.accept ? "accepted" : "rejected", nowIso(), s.id);
    return { ok: true };
  });

  // ---------- chat ----------

  f.get("/api/chat", async () => {
    const id = app.requireAthlete();
    return {
      messages: app.db.all("SELECT id, role, content, created_at FROM chat_message WHERE athlete_id = ? ORDER BY id DESC LIMIT 50", id).reverse(),
      notes: app.db.all("SELECT id, kind, text, start_date, end_date FROM chat_note WHERE athlete_id = ? AND deleted_at IS NULL AND end_date >= ? ORDER BY id", id, app.today()),
    };
  });

  f.post<{ Body: { message: string } }>("/api/chat", async (req) => {
    const msg = String(req.body?.message ?? "").trim().slice(0, 1000);
    if (!msg) bad("empty message");
    return chat(app, app.requireAthlete(), msg);
  });

  f.delete<{ Params: { id: string } }>("/api/notes/:id", async (req) => {
    app.db.run("UPDATE chat_note SET deleted_at = ? WHERE id = ? AND athlete_id = ?", nowIso(), Number(req.params.id), app.requireAthlete());
    return { ok: true };
  });

  f.patch<{ Params: { id: string }; Body: { endDate: string } }>("/api/notes/:id", async (req) => {
    if (!isDate(req.body?.endDate)) bad("invalid date");
    app.db.run("UPDATE chat_note SET end_date = ? WHERE id = ? AND athlete_id = ?", req.body.endDate, Number(req.params.id), app.requireAthlete());
    return { ok: true };
  });

  // ---------- progress (R8-18) ----------

  f.get("/api/progress", async () => {
    const id = app.requireAthlete();
    const today = app.today();
    const series = app.db.all("SELECT date, fitness, fatigue, form, load FROM daily_state WHERE athlete_id = ? AND date BETWEEN ? AND ? ORDER BY date", id, addDays(today, -90), today);
    const last = series[series.length - 1];
    const planned = plannedBetween(app, id, addDays(today, 1), addDays(today, 28));
    const loads = new Map<ISODate, number>();
    for (const r of planned) loads.set(r.date, (loads.get(r.date) ?? 0) + JSON.parse(r.workout_json).load);
    const projection = last ? performanceSeries(loads, addDays(today, 1), addDays(today, 28), { fitness: last.fitness, fatigue: last.fatigue }) : [];
    const snaps = app.db.all("SELECT effective_from AS date, ftp_w AS ftp, weight_kg AS weight, source FROM fitness_snapshot WHERE athlete_id = ? ORDER BY effective_from, id", id);
    const longest = app.db.get("SELECT date, moving_seconds, distance_m FROM activity WHERE athlete_id = ? AND is_master = 1 ORDER BY moving_seconds DESC LIMIT 1", id);
    const target = goals(app, id).find((g) => g.type === "endurance");
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = addDays(mondayOf(today), -7 * (11 - i));
      const end = addDays(start, 6);
      const rows = app.db.all(`SELECT status, workout_json FROM planned_workout WHERE athlete_id = ? AND date BETWEEN ? AND ? AND date < ? AND status IN ('completed','partial','missed','skipped','planned')`, id, start, end, today);
      const done = rows.filter((r) => r.status === "completed" || r.status === "partial").length;
      const load = app.db.get("SELECT SUM(load) AS l FROM activity WHERE athlete_id = ? AND is_master = 1 AND date BETWEEN ? AND ?", id, start, end)?.l ?? 0;
      const plannedLoad = rows.reduce((s, r) => s + JSON.parse(r.workout_json).load, 0);
      return { start, planned: rows.length, done, load: Math.round(load), plannedLoad: Math.round(plannedLoad) };
    });
    const phys = physiologyOn(app, id, today);
    return {
      series: series.map((s) => ({ date: s.date, fitness: s.fitness, fatigue: s.fatigue, form: s.form })),
      projection: projection.map((p) => ({ date: p.date, fitness: p.fitness, fatigue: p.fatigue, form: p.form })),
      ftp: snaps.map((s) => ({ date: s.date < addDays(today, -365) ? null : s.date, ftp: s.ftp, wkg: s.weight ? Math.round((s.ftp / s.weight) * 100) / 100 : null, source: s.source })),
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

  f.get("/api/settings", async () => {
    const id = app.requireAthlete();
    const acc = app.accountId()!;
    const ath = app.db.get("SELECT * FROM athlete WHERE id = ?", id) ?? {};
    const conn = app.db.get("SELECT external_athlete_id, status, last_sync_at, last_error, api_key_encrypted IS NOT NULL AS has_key FROM source_connection WHERE athlete_id = ?", id);
    return {
      profile: { ...physiologyOn(app, id, app.today()), heightCm: ath.height_cm, displayName: ath.display_name, outdoorPowerMeter: !!ath.outdoor_power_meter },
      email: app.db.get("SELECT email FROM account WHERE id = ?", acc)?.email,
      goals: goals(app, id),
      availability: availability(app, id),
      equipment: app.db.all("SELECT kind, model, role FROM equipment WHERE athlete_id = ? AND active = 1", id),
      coach: app.coachSettings(),
      connection: conn ? { athleteId: conn.external_athlete_id, status: conn.status, lastSyncAt: conn.last_sync_at, error: conn.last_error, hasKey: !!conn.has_key } : null,
      sessions: app.db.all("SELECT id, device_name, created_at, last_seen_at FROM device_session WHERE account_id = ? AND revoked_at IS NULL ORDER BY last_seen_at DESC", acc),
      pushDevices: app.db.all("SELECT id, platform, created_at, last_success_at FROM push_subscription WHERE account_id = ?", acc),
      backup: app.setting("backup", { dir: "" }),
      demo: app.config.demo,
    };
  });

  f.put<{ Body: any }>("/api/settings/profile", async (req) => {
    const id = app.requireAthlete();
    const b: any = req.body ?? {};
    const cur = physiologyOn(app, id, app.today());
    const next = {
      ftp: b.ftp !== undefined ? int(b.ftp, 50, 600, "ftp") : cur.ftp,
      lthr: b.lthr ? int(b.lthr, 80, 220, "lthr") : cur.lthr,
      maxHr: b.maxHr ? int(b.maxHr, 100, 240, "maxHr") : cur.maxHr,
      weightKg: b.weightKg ? Number(b.weightKg) : cur.weightKg,
    };
    if (JSON.stringify(next) !== JSON.stringify(cur)) addSnapshot(app, id, app.today(), next, "manual");
    app.db.run("UPDATE athlete SET height_cm = COALESCE(?, height_cm), outdoor_power_meter = COALESCE(?, outdoor_power_meter), display_name = COALESCE(?, display_name) WHERE id = ?",
      b.heightCm ?? null, b.outdoorPowerMeter === undefined ? null : b.outdoorPowerMeter ? 1 : 0, b.displayName ?? null, id);
    return { ok: true };
  });

  f.put<{ Body: { goals: any[] } }>("/api/settings/goals", async (req) => {
    const id = app.requireAthlete();
    if (!Array.isArray(req.body?.goals) || !req.body.goals.some((g) => g.role === "primary")) bad("Potrzebny jest cel główny.");
    saveGoals(app, id, req.body.goals);
    regenerate(app, id, "goal_change");
    await writeCalendar(app, id, app.today(), addDays(app.today(), 7)).catch(() => undefined);
    return { ok: true };
  });

  f.put<{ Body: OnboardingInput["availability"] }>("/api/settings/availability", async (req) => {
    const id = app.requireAthlete();
    const b = req.body;
    if (!Array.isArray(b?.days) || b.days.length !== 7) bad("Potrzebne 7 dni.");
    const before = availability(app, id);
    saveAvailability(app, id, b);
    const trainingChanged = JSON.stringify(before.days.map((d) => [d.available, d.maxMinutes])) !== JSON.stringify(b.days.map((d) => [d.available, d.available ? d.maxMinutes : 0]));
    if (trainingChanged) {
      regenerate(app, id, "availability_change");
      await writeCalendar(app, id, app.today(), addDays(app.today(), 7)).catch(() => undefined);
    }
    return { ok: true, regenerated: trainingChanged };
  });

  f.put<{ Body: any }>("/api/settings/coach", async (req) => {
    const b: any = req.body ?? {};
    const cur = app.coachSettings();
    app.setSetting("coach", {
      aiEnabled: b.aiEnabled ?? cur.aiEnabled,
      model: String(b.model ?? cur.model),
      fallbackModel: String(b.fallbackModel ?? cur.fallbackModel),
      embedModel: String(b.embedModel ?? cur.embedModel),
      ollamaUrl: String(b.ollamaUrl ?? cur.ollamaUrl),
      numCtx: Number(b.numCtx ?? cur.numCtx),
    });
    return { ok: true };
  });

  f.put<{ Body: { dir: string } }>("/api/settings/backup", async (req) => {
    const dir = String(req.body?.dir ?? "").trim();
    if (dir && !existsSync(dir)) bad("Ten folder nie istnieje.");
    app.setSetting("backup", { dir });
    return { ok: true };
  });

  f.post("/api/plan/regenerate", async () => {
    const id = app.requireAthlete();
    regenerate(app, id, "manual_regen");
    await writeCalendar(app, id, app.today(), addDays(app.today(), 7)).catch(() => undefined);
    return { ok: true };
  });

  f.post("/api/sync", async () => {
    const id = app.requireAthlete();
    const r = await syncAll(app, id, 14);
    await writeCalendar(app, id, app.today(), addDays(app.today(), 7)).catch(() => undefined);
    return r;
  });

  f.delete<{ Params: { id: string } }>("/api/sessions/:id", async (req) => {
    app.db.run("UPDATE device_session SET revoked_at = ? WHERE id = ? AND account_id = ?", nowIso(), Number(req.params.id), app.accountId());
    return { ok: true };
  });

  // ---------- push ----------

  f.get("/api/push/vapid", async () => ({ publicKey: vapid(app).publicKey }));

  f.post<{ Body: { subscription: any; platform?: string } }>("/api/push/subscribe", async (req) => {
    const s = req.body?.subscription;
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) bad("invalid subscription");
    app.db.run(
      `INSERT INTO push_subscription (account_id, endpoint, p256dh, auth, platform, created_at) VALUES (?,?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, failure_count = 0`,
      app.accountId(), s.endpoint, s.keys.p256dh, s.keys.auth, String(req.body.platform ?? "unknown").slice(0, 20), nowIso(),
    );
    return { ok: true };
  });

  f.delete<{ Params: { id: string } }>("/api/push/:id", async (req) => {
    app.db.run("DELETE FROM push_subscription WHERE id = ? AND account_id = ?", Number(req.params.id), app.accountId());
    return { ok: true };
  });

  f.post("/api/push/test", async () => ({ sent: await sendToAll(app, { title: "EveryDay", body: "Test powiadomienia — działa!", url: "/" }) }));

  // ---------- data ----------

  f.get("/api/export", async (_req, reply) => {
    reply.header("content-type", "application/zip").header("content-disposition", `attachment; filename="everyday-export-${app.today()}.zip"`);
    return exportZip(app);
  });

  f.post<{ Body: { confirm: string } }>("/api/account/delete", async (req, reply) => {
    if (req.body?.confirm !== "USUŃ") bad("Wpisz USUŃ, aby potwierdzić.");
    deleteAccount(app);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  f.get("/api/status", async () => {
    const id = app.athleteId();
    const llm = await app.llm();
    const dbFile = join(app.config.dataDir, app.config.demo ? "everyday-demo.db" : "everyday.db");
    let freeGb: number | null = null;
    try {
      const st = statfsSync(app.config.dataDir);
      freeGb = Math.round(((st.bavail * st.bsize) / 1e9) * 10) / 10;
    } catch {
      freeGb = null;
    }
    const lastJob = (job: string) => app.db.get("SELECT started_at, finished_at, status, error_code FROM job_run WHERE job = ? ORDER BY id DESC LIMIT 1", job) ?? null;
    return {
      now: app.now(),
      night: lastJob("night"),
      sync: lastJob("sync"),
      backup: app.db.meta("last_night_job") ?? null,
      connection: id ? app.db.get("SELECT status, last_sync_at, last_error FROM source_connection WHERE athlete_id = ?", id) ?? null : null,
      ai: { enabled: app.coachSettings().aiEnabled, reachable: !!llm, model: app.coachSettings().model },
      pushDevices: app.db.get("SELECT COUNT(*) AS n FROM push_subscription")?.n ?? 0,
      dbSizeMb: existsSync(dbFile) ? Math.round((statSync(dbFile).size / 1e6) * 10) / 10 : 0,
      freeGb,
      knowledgeChunks: app.db.get("SELECT COUNT(*) AS n FROM knowledge_chunk")?.n ?? 0,
      demo: app.config.demo,
    };
  });

  // ---------- PWA ----------

  if (existsSync(app.config.webDist)) {
    await f.register(fastifyStatic, { root: app.config.webDist, wildcard: false, index: ["index.html"] });
    const index = readFileSync(join(app.config.webDist, "index.html"));
    f.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/")) return reply.type("text/html").send(index);
      return reply.code(404).send({ error: "not found" });
    });
  }

  return f;
}

export { plannedActiveOn };
