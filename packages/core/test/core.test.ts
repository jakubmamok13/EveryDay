import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { App, createRouter, Db, type BackupStore, type DriveCopy, type Method, type Router } from "../src";
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

  it("counts other sports with their cycling weight in Fitness and Fatigue, toggle in Settings (D-047, D-069)", async () => {
    const others = app.db.all("SELECT sport, load FROM activity WHERE sport <> 'ride'");
    expect(others.some((a: any) => a.sport === "strength")).toBe(true);
    expect(others.some((a: any) => a.sport === "run")).toBe(true);
    expect(others.find((a: any) => a.sport === "strength")!.load).toBeGreaterThanOrEqual(37); // 50 min × 45/h floor
    const on = app.db.get("SELECT fitness, fatigue FROM daily_state WHERE date = '2026-10-06'")!;
    await call("PUT", "/api/settings/other-sports", { enabled: false });
    const off = app.db.get("SELECT fitness, fatigue FROM daily_state WHERE date = '2026-10-06'")!;
    expect(off.fatigue).toBeLessThan(on.fatigue); // the Friday run counts 60%
    expect(off.fitness).toBeLessThan(on.fitness);
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

/** Stand-in for the Drive folder (drive.ts): one file per device, Drive's own clock. */
class FakeDrive implements BackupStore {
  files = new Map<string, { copy: DriveCopy; data: string }>();
  saves = 0;
  down = false;
  private clock = Date.parse("2026-10-06T07:00:00Z");
  private seq = 0;
  constructor(private signedIn = true) {}
  ready() {
    return this.signedIn;
  }
  tick() {
    return new Date((this.clock += 60_000)).toISOString();
  }
  async list() {
    if (this.down) throw new Error("Brak połączenia z Dyskiem Google.");
    return [...this.files.values()].map((f) => f.copy);
  }
  async load(id: string) {
    return JSON.parse(this.files.get(id)!.data);
  }
  async save(device: string, file: any) {
    if (this.down) throw new Error("Brak połączenia z Dyskiem Google.");
    this.saves++;
    const old = [...this.files.values()].find((f) => f.copy.device === device);
    const copy = { id: old?.copy.id ?? `f${++this.seq}`, device, deviceName: device === "tablet" ? "Tablet" : "Telefon", modifiedTime: this.tick() };
    this.files.set(copy.id, { copy, data: JSON.stringify(file) });
    return copy;
  }
  /** Another device saves its copy. */
  otherDeviceSaves(device: string, data: any) {
    const copy = { id: `f${++this.seq}`, device, deviceName: "Tablet", modifiedTime: this.tick() };
    this.files.set(copy.id, { copy, data: JSON.stringify(data) });
    return copy;
  }
}

describe("D-068: copy in a Google Drive folder", () => {
  /** A real-mode phone (no demo) with the demo athlete's history. */
  async function phoneWithData(drive: FakeDrive) {
    const demo = await makeApp(true);
    await createRouter(demo).handle("POST", "/api/demo/seed");
    await nightJob(demo, demo.athleteId());
    const file = await createRouter(demo).handle("GET", "/api/export");
    const app = await makeApp(false);
    const router = createRouter(app);
    await router.handle("POST", "/api/import", file);
    app.backupStore = drive;
    return { app, file, call: (method: Method, url: string, body?: unknown): Promise<any> => router.handle(method, url, body) };
  }

  it("is off until signed in with a folder", async () => {
    const { call } = await phoneWithData(new FakeDrive(false));
    expect((await call("POST", "/api/backup/auto")).result).toBe("off");
    await expect(call("POST", "/api/backup/save")).rejects.toThrow(/połącz Dysk Google/);
  });

  it("first folder: uploads, skips unchanged data, saves after a change", async () => {
    const drive = new FakeDrive();
    const { call } = await phoneWithData(drive);
    expect((await call("POST", "/api/backup/folder-chosen")).state).toBe("saved");
    expect(drive.saves).toBe(1);
    const [only] = drive.files.values();
    const data = JSON.parse(only!.data);
    expect(data.tables.activity.length).toBeGreaterThan(100);
    expect(data.tables.source_connection.every((r: any) => r.api_key_encrypted === null)).toBe(true);
    expect((await call("GET", "/api/backup")).lastSavedAt).toBe(only!.copy.modifiedTime);
    expect((await call("POST", "/api/backup/auto")).result).toBe("unchanged");
    await call("POST", "/api/checkin", { feeling: "good", rideMode: "indoor" });
    expect((await call("POST", "/api/backup/auto")).result).toBe("saved");
    expect(drive.saves).toBe(2);
    expect(drive.files.size).toBe(1); // still one file: this device's own
  });

  it("a newer copy from another device is never overwritten silently", async () => {
    const drive = new FakeDrive();
    const { call, file } = await phoneWithData(drive);
    await call("POST", "/api/backup/folder-chosen");
    drive.otherDeviceSaves("tablet", file);
    await call("POST", "/api/checkin", { feeling: "good", rideMode: "indoor" });
    expect((await call("POST", "/api/backup/auto")).result).toBe("conflict");
    expect(drive.saves).toBe(1);
    expect((await call("GET", "/api/today")).backup).toMatchObject({ kind: "conflict", deviceName: "Tablet" });
    await call("POST", "/api/backup/keep-local");
    expect(drive.saves).toBe(2);
    expect(drive.files.size).toBe(2); // the tablet's copy stays on Drive
    expect((await call("GET", "/api/today")).backup).toBeNull();
    expect((await call("POST", "/api/backup/auto")).result).toBe("unchanged");
  });

  it("a phone with data asks before using a folder that already has a copy", async () => {
    const drive = new FakeDrive();
    const { call, file } = await phoneWithData(drive);
    drive.otherDeviceSaves("tablet", file);
    const r = await call("POST", "/api/backup/folder-chosen");
    expect(r).toMatchObject({ state: "exists", copy: { deviceName: "Tablet" } });
    expect(drive.saves).toBe(0);
  });

  it("a new phone starts from the newest copy, incl. levels and eFTP history; the API key stays", async () => {
    const drive = new FakeDrive();
    const { app: oldPhone, call: oldCall } = await phoneWithData(drive);
    await oldCall("POST", "/api/checkin", { feeling: "great", rideMode: "indoor" });
    await oldCall("POST", "/api/events", { date: "2026-11-15", name: "Maraton", priority: "B" });
    oldPhone.db.setMeta(`eftp:${oldPhone.athleteId()}`, "[255,258]");
    await oldCall("POST", "/api/backup/folder-chosen");

    const fresh = await makeApp(false);
    fresh.backupStore = drive;
    const call = (method: Method, url: string, body?: unknown): Promise<any> => createRouter(fresh).handle(method, url, body);
    expect((await call("GET", "/api/session")).onboarded).toBe(false);
    fresh.db.run("INSERT INTO source_connection (athlete_id, provider, api_key_encrypted, status) VALUES (?, 'intervals_icu', 'KEY-ON-NEW-PHONE', 'ok')", fresh.athleteId());
    const r = await call("POST", "/api/backup/folder-chosen");
    expect(r.state).toBe("restored");
    expect((await call("GET", "/api/session")).onboarded).toBe(true);
    expect((await call("GET", "/api/settings")).events.map((e: any) => e.name)).toEqual(["Maraton"]);
    expect(fresh.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM check_in")!.n).toBe(1);
    expect(fresh.db.meta(`eftp:${fresh.athleteId()}`)).toBe("[255,258]");
    expect(fresh.db.get<{ k: string | null }>("SELECT api_key_encrypted AS k FROM source_connection WHERE provider = 'intervals_icu'")?.k).toBe("KEY-ON-NEW-PHONE");
    // The new phone then keeps its own copy, next to the old phone's.
    expect((await call("POST", "/api/backup/auto")).result).toBe("saved");
    expect(drive.files.size).toBe(2);
    // The old phone, used again later, sees the newer copy and asks instead of saving.
    await oldCall("POST", "/api/checkin", { feeling: "ok", rideMode: "indoor" });
    expect((await oldCall("POST", "/api/backup/auto")).result).toBe("conflict");
  });

  it("errors are kept for Settings; Today warns only after 7 days without a copy", async () => {
    const drive = new FakeDrive();
    const { call } = await phoneWithData(drive);
    await call("POST", "/api/backup/folder-chosen");
    drive.down = true;
    await call("POST", "/api/checkin", { feeling: "good", rideMode: "indoor" });
    expect((await call("POST", "/api/backup/auto")).result).toBe("error");
    expect((await call("GET", "/api/backup")).error.message).toMatch(/Brak połączenia/);
    expect((await call("GET", "/api/today")).backup).toBeNull();
    drive.down = false;
    expect((await call("POST", "/api/backup/auto")).result).toBe("saved");
    expect((await call("GET", "/api/backup")).error).toBeNull();
  });

  it("demo mode never uploads; export never contains device-only meta", async () => {
    const drive = new FakeDrive();
    const demo = await makeApp(true);
    const router = createRouter(demo);
    await router.handle("POST", "/api/demo/seed");
    demo.backupStore = drive;
    expect(((await router.handle("POST", "/api/backup/auto")) as any).result).toBe("off");
    const file: any = await router.handle("GET", "/api/export");
    expect(Object.keys(file.meta).some((k) => k.startsWith("backup_") || k.startsWith("last_"))).toBe(false);
  });
});

describe("D-069: the Form model change recomputes once", () => {
  it("recomputes history and today's readiness after the update, and after loading an older copy", async () => {
    const app = await makeApp(true);
    const router = createRouter(app);
    await router.handle("POST", "/api/demo/seed");
    await router.handle("POST", "/api/catchup");
    expect(app.db.meta("perf_model")).toBe("3");
    const good = app.db.get<{ fitness: number }>("SELECT fitness FROM daily_state WHERE date = '2026-10-05'")!.fitness;
    // As if computed by the old model: wrong numbers and no version.
    app.db.run("UPDATE daily_state SET fitness = 1, fatigue = 99, form = -98 WHERE date = '2026-10-05'");
    app.db.run("DELETE FROM meta WHERE key = 'perf_model'");
    await router.handle("POST", "/api/catchup");
    expect(app.db.get<{ fitness: number }>("SELECT fitness FROM daily_state WHERE date = '2026-10-05'")!.fitness).toBeCloseTo(good);
    expect(app.db.meta("perf_model")).toBe("3");
  });
});
