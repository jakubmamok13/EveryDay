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

  it("errors are thrown with a status code", async () => {
    await expect(call("POST", "/api/checkin", { feeling: "meh" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(call("GET", "/api/nope")).rejects.toMatchObject({ statusCode: 404 });
    await expect(call("POST", "/api/wipe", { confirm: "no" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("night job on open marks missed workouts and keeps four weeks planned", async () => {
    app.clock = () => new Date("2026-10-08T06:00:00Z"); // Thursday
    expect((await call("POST", "/api/catchup")).ran).toBe("night");
    expect((await call("POST", "/api/catchup")).ran).toBe("none");
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
    expect(mapSource({ source: "GARMIN_CONNECT", device_name: "fenix 8" })).toBe("fenix");
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
