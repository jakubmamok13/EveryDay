import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { App, createRouter, Db, type Method, type Router } from "../src";
import { mapActivity, mapSource, mapWellness } from "../src/icu";
import { nightJob } from "../src/services/catchup";

const NOTES_DIR = resolve(__dirname, "../../../knowledge/method-notes");
const NOTES = readdirSync(NOTES_DIR).filter((f) => f.endsWith(".md")).map((f) => ({ path: f, text: readFileSync(join(NOTES_DIR, f), "utf8") }));
// Tuesday 2026-10-06, 08:00 in Warsaw.
const TUESDAY = new Date("2026-10-06T06:00:00Z");

async function makeApp(demo: boolean) {
  const SQL = await initSqlJs();
  const app = new App({ demo, timeZone: "Europe/Warsaw", notes: NOTES }, new Db(new SQL.Database()));
  app.clock = () => TUESDAY;
  return app;
}

describe("demo athlete: full morning loop with buttons", () => {
  let app: App;
  let router: Router;
  const call = (method: Method, url: string, body?: unknown): Promise<any> => router.handle(method, url, body);

  beforeAll(async () => {
    app = await makeApp(true);
    router = createRouter(app);
    expect(await call("GET", "/api/session")).toMatchObject({ onboarded: false, demo: true });
    await call("POST", "/api/demo/seed");
  });

  it("shows Tuesday's Key Workout, already sent to the calendar", async () => {
    expect(await call("GET", "/api/session")).toMatchObject({ onboarded: true });
    const t = await call("GET", "/api/today");
    expect(t.date).toBe("2026-10-06");
    expect(t.workout.category).toBe("sweet_spot");
    expect(t.workout.isKey).toBe(true);
    expect(t.workout.deliveryStatus).toBe("written");
  });

  it("'Czuję się gorzej' reduces the workout, explains it, and Undo restores it", async () => {
    const before = (await call("GET", "/api/today")).workout;
    const t = await call("POST", "/api/checkin", { feeling: "worse", rideMode: "indoor" });
    expect(t.checkIn.feeling).toBe("worse");
    expect(t.readiness.effective).toBe("yellow");
    expect(t.workout.load).toBeLessThan(before.load);
    expect(t.change.origin).toBe("engine");
    const lines = t.brief.lines.map((l: any) => `${l.label}: ${l.text}`).join("\n");
    expect(lines).toContain("Zmiana:");
    expect(lines).toContain("W domu (MyWhoosh)");
    const u = await call("POST", `/api/adaptations/${t.change.id}/undo`);
    expect(u.workout.load).toBe(before.load);
    expect(u.brief.lines.some((l: any) => l.key === "change")).toBe(false);
  });

  it("outdoor switches today's variant to heart-rate targets", async () => {
    const t = await call("POST", "/api/checkin", { feeling: "good", rideMode: "outdoor" });
    expect(t.workout.rideMode).toBe("outdoor");
    expect(t.workout.steps.find((s: any) => s.zone === 4).outdoor).toMatch(/Z4 HR \d+–\d+ ud\/min/);
    expect(t.brief.lines[0].text).toContain("Na zewnątrz (licznik / zegarek)");
  });

  it("'Totalne wyczerpanie' and 'Choroba' mean rest; Undo brings the workout back", async () => {
    const ex = await call("POST", "/api/checkin", { feeling: "exhausted", rideMode: "indoor" });
    expect(ex.workout).toBeNull();
    expect(ex.readiness.effective).toBe("red");
    expect(ex.brief.lines.map((l: any) => l.text).join(" ")).toContain("wyczerpanie");
    const sick = await call("POST", "/api/checkin", { feeling: "sick", rideMode: "indoor" });
    expect(sick.workout).toBeNull();
    expect(sick.readiness.effective).toBe("red");
    let t = sick;
    while (t.change) t = await call("POST", `/api/adaptations/${t.change.id}/undo`);
    t = await call("POST", "/api/checkin", { feeling: "good", rideMode: "indoor" });
    expect(t.workout?.category).toBe("sweet_spot");
  });

  it("quick actions: shorten, pain with a body part, travel, and why", async () => {
    const r1 = await call("POST", "/api/actions/shorten", { minutes: 30 });
    expect(r1.ok).toBe(true);
    expect((await call("GET", "/api/today")).workout.minutes).toBeLessThanOrEqual(30);
    const r2 = await call("POST", "/api/actions/pain", { part: "Kolano" });
    expect(r2.messages[0]).toContain("Zapamiętałem");
    const a = await call("GET", "/api/actions");
    expect(a.notes.some((n: any) => n.kind === "injury" && n.text === "Ból: Kolano")).toBe(true);
    expect(a.why.workout.purpose.length).toBeGreaterThan(10);
    expect(a.why.sections.length).toBeGreaterThan(0);
    const r3 = await call("POST", "/api/actions/travel", { fromDate: "2026-10-08", days: 3 });
    expect(r3.ok).toBe(true);
    const week = await call("GET", "/api/week");
    const thu = week.days.find((d: any) => d.date === "2026-10-08");
    expect(thu.workouts.every((w: any) => w.status !== "planned")).toBe(true);
    const skipped = thu.workouts.find((w: any) => w.status === "skipped");
    expect(skipped).toBeTruthy();
    await call("POST", `/api/planned/${skipped.id}/restore`);
    const thu2 = (await call("GET", "/api/week")).days.find((d: any) => d.date === "2026-10-08");
    expect(thu2.workouts.some((w: any) => w.status === "planned")).toBe(true);
    const ri = await call("GET", "/api/actions");
    expect(ri.notes.some((n: any) => n.kind === "travel" && n.start_date === "2026-10-08")).toBe(true);
  });

  it("week, progress, status, export and import respond", async () => {
    const w = await call("GET", "/api/week");
    expect(w.days).toHaveLength(7);
    expect(w.focus).toBe("sweet_spot");
    const p = await call("GET", "/api/progress");
    expect(p.series.length).toBeGreaterThan(80);
    expect(p.projection).toHaveLength(28);
    expect(p.current.wkg).toBe(3.33);
    const s = await call("GET", "/api/status");
    expect(s.notes).toBe(NOTES.length);
    const zwo = await call("GET", `/api/planned/${(await call("GET", "/api/today")).workout.id}/zwo`);
    expect(zwo.content).toContain("<workout_file>");
    const file = await call("GET", "/api/export");
    expect(file.app).toBe("everyday");
    const plannedCount = file.tables.planned_workout.length;
    expect(plannedCount).toBeGreaterThan(10);
    // Round trip into a fresh phone.
    const other = await makeApp(true);
    const r2 = createRouter(other);
    await r2.handle("POST", "/api/import", JSON.parse(JSON.stringify(file)));
    expect(other.onboarded()).toBe(true);
    expect(other.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM planned_workout")!.n).toBe(plannedCount);
    expect(((await r2.handle("GET", "/api/today")) as any).workout.name).toBe((await call("GET", "/api/today")).workout.name);
  });

  it("explains today: plan, every signal, the rule and the decision (D-048)", async () => {
    await call("POST", "/api/checkin", { feeling: "good", rideMode: "indoor" });
    const why = await call("GET", "/api/today/why");
    expect(why.plan.lines[0]).toMatch(/^Blok 1: akcent Sweet Spot/);
    expect(why.plan.lines.join(" ")).toContain("trening kluczowy");
    expect(why.signals.find((x: any) => x.key === "check_in").value).toBe("Dobrze");
    expect(why.signals.every((x: any) => x.label && x.ratingWord)).toBe(true);
    expect(why.rule).toMatch(/→ (zielony|żółty|czerwony) dzień/);
    expect(why.decision.whatIf).toHaveLength(3);
    expect(why.load.counted).toBe(true);
  });

  it("counts other sports: full Load in Fatigue, part in Fitness, toggle in Settings (D-047)", async () => {
    const others = app.db.all("SELECT sport, load FROM activity WHERE sport <> 'ride'");
    expect(others.some((a: any) => a.sport === "strength")).toBe(true);
    expect(others.some((a: any) => a.sport === "run")).toBe(true);
    expect(others.find((a: any) => a.sport === "strength")!.load).toBeGreaterThanOrEqual(37); // 50 min × 45/h floor
    const on = app.db.get("SELECT fitness, fatigue FROM daily_state WHERE date = '2026-10-06'")!;
    await call("PUT", "/api/settings/other-sports", { enabled: false });
    const off = app.db.get("SELECT fitness, fatigue FROM daily_state WHERE date = '2026-10-06'")!;
    expect(off.fatigue).toBeLessThan(on.fatigue);
    expect(on.fitness - off.fitness).toBeLessThan(on.fatigue - off.fatigue);
    expect((await call("GET", "/api/settings")).otherSports).toBe(false);
    expect((await call("GET", "/api/today/why")).load.counted).toBe(false);
    await call("PUT", "/api/settings/other-sports", { enabled: true });
    const week = await call("GET", "/api/week?start=2026-09-28");
    const labels = week.days.flatMap((d: any) => d.rides.map((r: any) => r.sportLabel)).filter(Boolean);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("errors are thrown with a status code", async () => {
    await expect(call("POST", "/api/checkin", { feeling: "meh" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(call("GET", "/api/nope")).rejects.toMatchObject({ statusCode: 404 });
    await expect(call("POST", "/api/wipe", { confirm: "no" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("night job on open marks missed workouts and keeps four weeks planned", async () => {
    app.clock = () => new Date("2026-10-08T06:00:00Z"); // Thursday
    expect((await call("POST", "/api/catchup")).ran).toBe("night");
    expect((await call("POST", "/api/catchup")).ran).toBe("none");
    // Regression: a run that had nothing to do must not block the next one.
    app.clock = () => new Date("2026-10-08T07:00:00Z");
    expect((await call("POST", "/api/catchup")).ran).toBe("sync");
    const tue = app.db.get("SELECT status FROM planned_workout WHERE date = '2026-10-06' AND status <> 'replaced' ORDER BY id DESC LIMIT 1");
    expect(["completed", "partial", "missed", "skipped"]).toContain(tue?.status);
    const last = app.db.get("SELECT MAX(date) AS d FROM planned_workout WHERE status = 'planned'")?.d;
    expect(last >= "2026-10-27").toBe(true);
    await nightJob(app, app.athleteId()); // idempotent
    app.clock = () => TUESDAY;
  });

  it("wipe leaves nothing behind", async () => {
    await call("POST", "/api/wipe", { confirm: "USUŃ" });
    expect(app.onboarded()).toBe(false);
    expect(app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM planned_workout")!.n).toBe(0);
  });
});

describe("own profile (not demo)", () => {
  it("starts empty and needs onboarding; data persists through export()", async () => {
    const app = await makeApp(false);
    const router = createRouter(app);
    expect(await router.handle("GET", "/api/session")).toMatchObject({ onboarded: false, demo: false });
    await expect(router.handle("POST", "/api/demo/seed")).rejects.toMatchObject({ statusCode: 400 });
    expect(app.icu()).toBeNull();
    let writes = 0;
    const SQL = await initSqlJs();
    const db = new Db(new SQL.Database(app.db.export()), () => writes++);
    db.run("INSERT INTO meta (key, value) VALUES ('x', '1')");
    expect(writes).toBe(1);
    db.tx(() => {
      db.setMeta("a", "1");
      db.setMeta("b", "2");
    });
    expect(writes).toBe(2);
  });
});

describe("intervals.icu mapping (defensive, confirmed in S05)", () => {
  it("maps sources and indoor rides", () => {
    expect(mapSource({ source: "GARMIN_CONNECT", device_name: "Garmin watch" })).toBe("fenix");
    expect(mapSource({ source: "WAHOO", device_name: "ELEMNT BOLT" })).toBe("bolt");
    expect(mapSource({ source: "OAUTH_CLIENT", device_name: "MyWhoosh" })).toBe("mywhoosh");
    const a = mapActivity({ id: "i1", type: "VirtualRide", start_date_local: "2026-10-05T18:00:00", moving_time: 3600, icu_weighted_avg_watts: 240, icu_training_load: 70, source: "MYWHOOSH" });
    expect(a).toMatchObject({ indoor: true, source: "mywhoosh", weightedPower: 240, load: 70, stub: false });
    expect(mapActivity({ id: "s1", type: "Ride", source: "STRAVA" }).stub).toBe(true);
  });
  it("maps wellness including Body Battery custom fields", () => {
    const w = mapWellness({ id: "2026-10-05", hrv: 58, restingHR: 48, sleepSecs: 27000, BodyBatteryMax: 82, readiness: 71 });
    expect(w).toMatchObject({ date: "2026-10-05", hrv: 58, restingHr: 48, sleepSeconds: 27000, bodyBatteryMax: 82, readiness: 71 });
  });
});

describe("research features on the demo athlete (D-049 …)", () => {
  let app: App;
  let router: Router;
  const call = (method: Method, url: string, body?: unknown): Promise<any> => router.handle(method, url, body);
  const at = (iso: string) => (app.clock = () => new Date(iso));
  const greenToday = () => {
    const d = app.today();
    const st = app.db.get("SELECT readiness_json FROM daily_state WHERE date = ?", d)!;
    const r = JSON.parse(st.readiness_json);
    r.effective = "green"; r.state = "green"; r.overrides = []; r.inputs = r.inputs.map((i: any) => ({ ...i, rating: i.rating === "missing" ? "missing" : "ok" }));
    app.db.run("UPDATE daily_state SET readiness_json = ?, form_pct = 0.02 WHERE date = ?", JSON.stringify(r), d);
  };

  beforeAll(async () => {
    app = await makeApp(true);
    router = createRouter(app);
    await call("POST", "/api/demo/seed");
  });

  it("B1/D1/C2/D2/C3: challenge, carbs, a hot A event with taper, heat plan and forecast", async () => {
    const t = await call("GET", "/api/today");
    expect(t.workout.challenge).toMatchObject({ key: expect.any(String), category: "Sweet Spot" });
    app.db.run("INSERT INTO long_ride_proposal (athlete_id, proposed_date, minutes, created_at) VALUES (?, '2026-10-17', 240, '2026-10-06T06:00:00Z')", app.athleteId());
    expect((await call("GET", "/api/today")).longRide).toMatchObject({ proposed_date: "2026-10-17" });
    expect(t.carbs.text).toMatch(/Węglowodany dziś: (mało|średnio|dużo|bardzo dużo)/);
    await call("POST", "/api/events", { date: "2026-10-18", name: "Gran Fondo", priority: "A", hot: true });
    const planned = (d: string) => app.db.all("SELECT workout_slug FROM planned_workout WHERE date = ? AND status = 'planned'", d).map((r: any) => r.workout_slug);
    expect(planned("2026-10-17")).toEqual(["openers"]);
    expect(planned("2026-10-18")).toEqual([]);
    const today = await call("GET", "/api/today");
    expect(today.longRide).toBeNull(); // the Long Ride Day before the A event is withdrawn
    expect(today.heat).toMatchObject({ event: "Gran Fondo", daysToGo: 12, target: 10 });
    const ev = await call("GET", "/api/events");
    expect(ev.forecast[0]).toMatchObject({ name: "Gran Fondo", priority: "A", target: [5, 20] });
    expect(typeof ev.forecast[0].form).toBe("number");
    const wk = await call("GET", "/api/week?start=2026-10-12");
    expect(wk.events.map((e: any) => e.name)).toEqual(["Gran Fondo"]);
  });

  it("C1: this week is different, then back to normal", async () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((w) => ({ available: w === 3 || w === 5, maxMinutes: 90, defaultRideMode: "indoor" }));
    await call("PUT", "/api/week/override", { start: "2026-10-05", days });
    const wk = await call("GET", "/api/week");
    expect(wk.override).toBe(true);
    const future = wk.days.filter((d: any) => d.date > "2026-10-06" && d.workouts.some((w: any) => w.status === "planned")).map((d: any) => d.date);
    expect(future).toEqual(["2026-10-07", "2026-10-09"]);
    await call("DELETE", "/api/week/override?start=2026-10-05");
    expect((await call("GET", "/api/week")).override).toBe(false);
  });

  it("B3/B5/B6: power profile, durability and FTP confidence from power streams", async () => {
    await call("POST", "/api/sync");
    await call("POST", "/api/sync");
    const p = await call("GET", "/api/progress");
    expect(p.levels.find((l: any) => l.category === "threshold")).toMatchObject({ max: 8 });
    expect(p.profile.rows).toHaveLength(4);
    expect(p.profile.riderType).toBeTruthy();
    expect(p.durability.rides).toBeGreaterThan(0);
    expect(p.durability.keep1200).toBeGreaterThan(80);
    expect(["high", "medium", "low"]).toContain(p.ftpInsight.confidence);
    expect(p.ftpInsight.text).toContain("Pewność");
  });

  it("A1: green light for an extra ride on a fresh rest day; A4: warning for tomorrow", async () => {
    at("2026-10-07T06:00:00Z"); // Wednesday, Key Workout on Thursday
    await call("POST", "/api/catchup");
    await call("POST", "/api/checkin", { feeling: "great", rideMode: "indoor" });
    greenToday();
    const t = await call("GET", "/api/today");
    expect(t.restDay).toBe(true);
    expect(t.bonusOffer.options.length).toBeGreaterThan(0);
    expect(t.bonusOffer.options.every((o: any) => o.intensity === "easy" && o.minutes <= 75)).toBe(true);
    expect(t.bonusOffer.options.at(-1).impact.date).toBe("2026-10-08");
    const pick = t.bonusOffer.options.at(-1);
    const after = await call("POST", "/api/bonus/accept", { slug: pick.slug, minutes: pick.minutes, rideMode: "indoor" });
    expect(after.workout.role).toBe("bonus");
    expect(after.bonusOffer).toBeNull();
    // A4: a huge ride today makes tomorrow's Key Workout risky.
    app.db.run(
      "INSERT INTO activity (athlete_id, icu_id, source_device, type, name, date, start_at, moving_seconds, load, sport, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      app.athleteId(), "big1", "bolt", "Ride", "Wyścig", "2026-10-07", "2026-10-07T07:00:00", 5 * 3600, 330, "ride", new Date().toISOString(),
    );
    const w = await call("GET", "/api/today");
    expect(["yellow", "red"]).toContain(w.tomorrow.level);
    const before = app.db.get("SELECT workout_json FROM planned_workout WHERE date = '2026-10-08' AND status = 'planned'")!;
    const r = await call("POST", "/api/tomorrow/easier");
    expect(r.message).toContain("Zmiana");
    const thu = app.db.get("SELECT workout_json FROM planned_workout WHERE date = '2026-10-08' AND status = 'planned'")!;
    expect(JSON.parse(thu.workout_json).load).toBeLessThan(JSON.parse(before.workout_json).load);
    expect(r.tomorrow).toBeNull();
  });

  it("B2: 5-step rating with 'completed' drives progression", async () => {
    at("2026-10-09T06:00:00Z");
    expect((await call("POST", "/api/catchup")).ran).toBe("night");
    const t = await call("GET", "/api/today");
    const ride = t.unrated[0];
    expect(ride).toBeTruthy();
    await call("POST", `/api/rides/${ride.id}/rating`, { effort: "easy", completed: "yes" });
    expect(app.db.get("SELECT effort, completed, rpe, feel FROM activity WHERE id = ?", ride.id)).toMatchObject({ effort: "easy", completed: "yes", rpe: 3, feel: "too_easy" });
    await expect(call("POST", `/api/rides/${ride.id}/rating`, { effort: "meh" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("D3: Monday summary; C5: HIT block after the A event", async () => {
    at("2026-10-12T06:00:00Z");
    await call("POST", "/api/catchup");
    const t = await call("GET", "/api/today");
    expect(t.summary.lines[0]).toMatch(/^Treningi: \d+ z \d+/);
    expect((await call("POST", "/api/summary/dismiss")).summary).toBeNull();
    const info = await call("GET", "/api/plan/hit-block");
    expect(info.candidate).toBe("2026-11-02");
    expect(info.available).toBe(true);
    const r = await call("POST", "/api/plan/hit-block", { on: true });
    expect(r.ok).toBe(true);
    expect((await call("GET", "/api/plan/hit-block")).active.start).toBe("2026-11-02");
    at("2026-11-02T06:00:00Z");
    await call("POST", "/api/catchup");
    const hard = app.db.all("SELECT workout_json FROM planned_workout WHERE date BETWEEN '2026-11-02' AND '2026-11-08' AND status IN ('planned','completed','partial')")
      .filter((w: any) => JSON.parse(w.workout_json).category === "vo2max");
    expect(hard.length).toBeGreaterThanOrEqual(3);
  });
});

describe("C4: gentle return after a break", () => {
  it("drops levels, suggests a lower FTP and makes the first days easy", async () => {
    const app = await makeApp(false);
    app.clock = () => new Date("2026-10-20T06:00:00Z");
    const router = createRouter(app);
    await router.handle("POST", "/api/onboarding/complete", {
      profile: { weightKg: 75, ftp: 250, lthr: 162, maxHr: 184 },
      goals: [{ role: "primary", type: "raise_ftp" }],
      availability: { days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, available: weekday !== 5, maxMinutes: 90, defaultRideMode: "indoor", notifyTime: "07:00" })), longRideDaysAllowed: false, longRideEveryWeeks: 5 },
      equipment: [],
    });
    app.db.run("UPDATE athlete SET ladder_json = ?", JSON.stringify({ sweet_spot: 4, threshold: 3 }));
    app.db.run("INSERT INTO activity (athlete_id, icu_id, source_device, type, date, start_at, moving_seconds, load, sport, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      app.athleteId(), "old", "mywhoosh", "VirtualRide", "2026-10-01", "2026-10-01T18:00:00", 3600, 70, "ride", new Date().toISOString());
    const { checkReturn } = await import("../src/services/extras");
    expect(await checkReturn(app, app.athleteId())).toBe(true);
    expect(await checkReturn(app, app.athleteId())).toBe(false); // once per break
    expect(JSON.parse(app.db.get("SELECT ladder_json FROM athlete")!.ladder_json)).toEqual({ sweet_spot: 2, threshold: 1 });
    expect(app.db.get("SELECT suggested_ftp, basis FROM ftp_suggestion")).toEqual({ suggested_ftp: 243, basis: "detraining" });
    const first = app.db.all("SELECT date, workout_json FROM planned_workout WHERE status = 'planned' AND date BETWEEN '2026-10-20' AND '2026-10-22'");
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((r: any) => JSON.parse(r.workout_json).intensity === "easy")).toBe(true);
    expect(((await router.handle("GET", "/api/today")) as any).comeback.text).toContain("Powrót po 18 dniach");
  });
});

describe("answers are remembered (no daily re-asking)", () => {
  it("„Nie tym razem” on a Long Ride Day is not asked again the next days", async () => {
    const app = await makeApp(true);
    const router = createRouter(app);
    const call = (method: Method, url: string, body?: unknown): Promise<any> => router.handle(method, url, body);
    await call("POST", "/api/demo/seed");
    await nightJob(app, app.athleteId());
    const p = (await call("GET", "/api/today")).longRide;
    expect(p).toMatchObject({ proposed_date: "2026-10-17" });
    await call("POST", `/api/long-ride/${p.id}`, { confirm: false });
    for (const day of ["07", "08", "09", "10"]) {
      app.clock = () => new Date(`2026-10-${day}T06:00:00Z`);
      await nightJob(app, app.athleteId());
      expect((await call("GET", "/api/today")).longRide).toBeNull();
      expect((await call("GET", "/api/week")).longRide ?? null).toBeNull();
    }
    // The next weekend may be proposed once, a week later.
    app.clock = () => new Date("2026-10-11T06:00:00Z");
    await nightJob(app, app.athleteId());
    expect((await call("GET", "/api/today")).longRide).toMatchObject({ proposed_date: "2026-10-24" });
  });

  it("a rejected FTP suggestion does not come back the next day", async () => {
    const app = await makeApp(true);
    const router = createRouter(app);
    const call = (method: Method, url: string, body?: unknown): Promise<any> => router.handle(method, url, body);
    await call("POST", "/api/demo/seed");
    const fake = app.icu()!;
    app.icu = () => Object.assign(Object.create(Object.getPrototypeOf(fake)), fake, { athlete: async () => ({ ...(await fake.athlete()), eftp: 264 }) });
    app.db.setMeta(`eftp:${app.athleteId()}`, JSON.stringify([262]));
    app.clock = () => new Date("2026-10-07T06:00:00Z");
    await nightJob(app, app.athleteId());
    const s = (await call("GET", "/api/today")).ftpSuggestion;
    expect(s).toMatchObject({ suggested_ftp: 263 });
    await call("POST", `/api/ftp-suggestion/${s.id}`, { accept: false });
    app.clock = () => new Date("2026-10-08T06:00:00Z");
    await nightJob(app, app.athleteId());
    expect((await call("GET", "/api/today")).ftpSuggestion).toBeNull();
  });
});

/** Stand-in for tools/everyday-kopia.gs (same protocol); also checks the requests stay CORS-simple. */
class FakeScript {
  static URL = "https://script.google.com/macros/s/AKfyTEST_123-abc/exec";
  latest: { savedAt: string; device: string | null; data: any } | null = null;
  posts = 0;
  down = false;
  fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (this.down) throw new TypeError("Failed to fetch");
    const u = new URL(String(url));
    if (`${u.origin}${u.pathname}` !== FakeScript.URL) return new Response("<html>Not found</html>", { status: 404 });
    expect(init?.headers).toBeUndefined(); // no preflight: Apps Script cannot answer OPTIONS
    const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
    if (init?.method === "POST") {
      expect(typeof init.body).toBe("string"); // sent as text/plain
      const b = JSON.parse(init.body as string);
      if (b.op !== "save" || b.data?.app !== "everyday") return json({ ok: false, error: "To nie jest kopia EveryDay." });
      this.posts++;
      this.latest = { savedAt: b.savedAt, device: b.device, data: b.data };
      return json({ ok: true, savedAt: b.savedAt });
    }
    if (!this.latest) return json({ ok: true, empty: true });
    if (u.searchParams.get("op") === "load") return json({ ok: true, ...this.latest });
    return json({ ok: true, savedAt: this.latest.savedAt, device: this.latest.device });
  };
}

describe("D-067: copy on Google Drive through an Apps Script link", () => {
  /** A real-mode phone (no demo) with the demo athlete's history. */
  async function phoneWithData(script: FakeScript) {
    const demo = await makeApp(true);
    await createRouter(demo).handle("POST", "/api/demo/seed");
    await nightJob(demo, demo.athleteId());
    const file = await createRouter(demo).handle("GET", "/api/export");
    const app = await makeApp(false);
    const router = createRouter(app);
    await router.handle("POST", "/api/import", file);
    app.fetch = script.fetch as typeof fetch;
    return { app, call: (method: Method, url: string, body?: unknown): Promise<any> => router.handle(method, url, body) };
  }

  it("rejects anything that is not a deployed script address", async () => {
    const { call } = await phoneWithData(new FakeScript());
    await expect(call("POST", "/api/backup/connect", { url: "https://drive.google.com/drive/folders/abc?usp=sharing" })).rejects.toThrow(/script\.google\.com/);
  });

  it("connects, saves, skips unchanged data, saves after a change", async () => {
    const script = new FakeScript();
    const { app, call } = await phoneWithData(script);
    const c = await call("POST", "/api/backup/connect", { url: FakeScript.URL });
    expect(c.state).toBe("saved");
    expect(script.posts).toBe(1);
    expect(script.latest!.data.tables.activity.length).toBeGreaterThan(100);
    expect(script.latest!.data.tables.source_connection.every((r: any) => r.api_key_encrypted === null)).toBe(true);
    expect((await call("GET", "/api/backup")).lastSavedAt).toBe(script.latest!.savedAt);
    expect((await call("POST", "/api/backup/auto")).result).toBe("unchanged");
    expect(script.posts).toBe(1);
    await call("POST", "/api/checkin", { feeling: "good", rideMode: "indoor" });
    expect((await call("POST", "/api/backup/auto")).result).toBe("saved");
    expect(script.posts).toBe(2);
    expect(script.latest!.data.tables.check_in).toHaveLength(1);
    void app;
  });

  it("a newer copy from another device is never overwritten silently", async () => {
    const script = new FakeScript();
    const { call } = await phoneWithData(script);
    await call("POST", "/api/backup/connect", { url: FakeScript.URL });
    script.latest = { ...script.latest!, device: "other-phone", savedAt: new Date(Date.now() + 60_000).toISOString() };
    await call("POST", "/api/checkin", { feeling: "good", rideMode: "indoor" });
    expect((await call("POST", "/api/backup/auto")).result).toBe("conflict");
    expect(script.posts).toBe(1);
    expect((await call("GET", "/api/today")).backup).toMatchObject({ kind: "conflict" });
    await call("POST", "/api/backup/keep-local");
    expect(script.posts).toBe(2);
    expect((await call("GET", "/api/today")).backup).toBeNull();
  });

  it("restores everything on a new phone, incl. levels and eFTP history; the API key stays", async () => {
    const script = new FakeScript();
    const { app: oldPhone, call: oldCall } = await phoneWithData(script);
    await oldCall("POST", "/api/checkin", { feeling: "great", rideMode: "indoor" });
    await oldCall("POST", "/api/events", { date: "2026-11-15", name: "Maraton", priority: "B" });
    oldPhone.db.setMeta(`eftp:${oldPhone.athleteId()}`, "[255,258]");
    await oldCall("POST", "/api/backup/connect", { url: FakeScript.URL });

    const fresh = await makeApp(false);
    fresh.fetch = script.fetch as typeof fetch;
    const call = (method: Method, url: string, body?: unknown): Promise<any> => createRouter(fresh).handle(method, url, body);
    expect((await call("GET", "/api/session")).onboarded).toBe(false);
    fresh.db.run("INSERT INTO source_connection (athlete_id, provider, api_key_encrypted, status) VALUES (?, 'intervals_icu', 'KEY-ON-NEW-PHONE', 'ok')", fresh.athleteId());
    const r = await call("POST", "/api/backup/restore", { url: FakeScript.URL });
    expect(r.onboarded).toBe(true);
    expect((await call("GET", "/api/settings")).events.map((e: any) => e.name)).toEqual(["Maraton"]);
    expect(fresh.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM check_in")!.n).toBe(1);
    expect(fresh.db.meta(`eftp:${fresh.athleteId()}`)).toBe("[255,258]");
    const key = fresh.db.get<{ k: string | null }>("SELECT api_key_encrypted AS k FROM source_connection WHERE provider = 'intervals_icu'")?.k;
    expect(key).toBe("KEY-ON-NEW-PHONE");
    // Just restored: nothing to upload, and no conflict with the copy it came from.
    expect((await call("POST", "/api/backup/auto")).result).toBe("unchanged");
    expect((await call("GET", "/api/backup")).connected).toBe(true);
  });

  it("network errors are kept for Settings and shown on Today when no copy was saved", async () => {
    const script = new FakeScript();
    const { call } = await phoneWithData(script);
    await call("POST", "/api/backup/connect", { url: FakeScript.URL });
    script.down = true;
    await call("POST", "/api/checkin", { feeling: "good", rideMode: "indoor" });
    expect((await call("POST", "/api/backup/auto")).result).toBe("error");
    expect((await call("GET", "/api/backup")).error.message).toMatch(/Brak połączenia/);
    expect((await call("GET", "/api/today")).backup).toBeNull(); // a copy was saved less than 7 days ago
    script.down = false;
    expect((await call("POST", "/api/backup/auto")).result).toBe("saved");
    expect((await call("GET", "/api/backup")).error).toBeNull();
  });

  it("demo mode never uploads; export never contains device-only meta", async () => {
    const script = new FakeScript();
    const demo = await makeApp(true);
    const router = createRouter(demo);
    await router.handle("POST", "/api/demo/seed");
    demo.fetch = script.fetch as typeof fetch;
    demo.db.setMeta("backup_url", FakeScript.URL);
    expect(((await router.handle("POST", "/api/backup/auto")) as any).result).toBe("off");
    const file: any = await router.handle("GET", "/api/export");
    expect(Object.keys(file.meta).some((k) => k.startsWith("backup_") || k.startsWith("last_"))).toBe(false);
  });
});
