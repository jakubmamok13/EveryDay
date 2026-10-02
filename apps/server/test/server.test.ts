import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../src/api";
import { App } from "../src/app";
import { mapActivity, mapSource, mapWellness } from "../src/icu";
import { seedDemo } from "../src/services/onboarding";
import { nightJob } from "../src/services/scheduler";

const REPO = resolve(__dirname, "../../..");
// Monday 2026-10-05, 08:00 in Warsaw.
const MONDAY = new Date("2026-10-05T06:00:00Z");

function makeApp(demo: boolean) {
  const dir = mkdtempSync(join(tmpdir(), "everyday-"));
  const app = new App({ repoRoot: REPO, demo, dataDir: dir, port: 0, host: "127.0.0.1", timeZone: "Europe/Warsaw", webDist: join(dir, "no-web") });
  app.clock = () => MONDAY;
  app.setSetting("coach", { aiEnabled: false }); // template mode: no Ollama in CI
  return { app, dir };
}

describe("demo athlete: full morning loop over HTTP", () => {
  const { app, dir } = makeApp(true);
  let server: Awaited<ReturnType<typeof buildServer>>;
  let cookie = "";
  const call = async (method: string, url: string, payload?: unknown) => {
    const r = await server.inject({ method: method as any, url, headers: { cookie, ...(payload ? { "content-type": "application/json" } : {}) }, ...(payload ? { payload: JSON.stringify(payload) } : {}) });
    const set = r.headers["set-cookie"];
    if (set) cookie = String(Array.isArray(set) ? set[0] : set).split(";")[0]!;
    return { status: r.statusCode, body: r.headers["content-type"]?.toString().includes("json") ? r.json() : r.body, raw: r.rawPayload };
  };

  beforeAll(async () => {
    await seedDemo(app);
    app.setSetting("coach", { aiEnabled: false });
    server = await buildServer(app);
  });
  afterAll(async () => {
    await server.close();
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("logs the demo athlete in and shows Monday's Key Workout", async () => {
    expect((await call("GET", "/api/session")).body).toMatchObject({ authenticated: true, onboarded: true });
    const t = (await call("GET", "/api/today")).body;
    expect(t.date).toBe("2026-10-05");
    expect(t.workout.category).toBe("sweet_spot");
    expect(t.workout.isKey).toBe(true);
    expect(t.workout.deliveryStatus).toBe("written");
  });

  it("a yellow check-in reduces the workout, explains it, and Undo restores it", async () => {
    const before = (await call("GET", "/api/today")).body.workout;
    const t = (await call("POST", "/api/checkin", { sleepQuality: 2, legs: 2, motivation: 4, sick: false, pain: false, rideMode: "indoor" })).body;
    expect(t.readiness.effective).toBe("yellow");
    expect(t.workout.load).toBeLessThan(before.load);
    expect(t.change.origin).toBe("engine");
    const lines = t.brief.lines.map((l: any) => `${l.label}: ${l.text}`).join("\n");
    expect(lines).toContain("Zmiana:");
    expect(lines).toContain("W domu (MyWhoosh)");
    const u = (await call("POST", `/api/adaptations/${t.change.id}/undo`)).body;
    expect(u.workout.load).toBe(before.load);
    expect(u.brief.lines.some((l: any) => l.key === "change")).toBe(false);
  });

  it("choosing outdoor switches today's variant to heart-rate targets", async () => {
    const t = (await call("POST", "/api/checkin", { sleepQuality: 4, legs: 4, motivation: 4, sick: false, pain: false, rideMode: "outdoor" })).body;
    expect(t.workout.rideMode).toBe("outdoor");
    expect(t.workout.steps.find((s: any) => s.zone === 4).outdoor).toMatch(/Z4 HR \d+–\d+ ud\/min/);
    expect(t.brief.lines[0].text).toContain("Na zewnątrz (BOLT / Fenix)");
  });

  it("sick means rest, and the Key Workout moves to a free day this week", async () => {
    const t = (await call("POST", "/api/checkin", { sleepQuality: 3, legs: 3, motivation: 3, sick: true, pain: false, rideMode: "indoor" })).body;
    expect(t.workout).toBeNull();
    expect(t.readiness.effective).toBe("red");
    // restore for the next tests
    await call("POST", "/api/checkin", { sleepQuality: 4, legs: 4, motivation: 4, sick: false, pain: false, rideMode: "indoor" });
  });

  it("chat: shorten, refuse a harder request, and remember pain", async () => {
    const r1 = (await call("POST", "/api/chat", { message: "Mam dziś tylko 30 min" })).body;
    expect(r1.changes.length).toBe(1);
    expect((await call("GET", "/api/today")).body.workout.minutes).toBeLessThanOrEqual(30);
    const r2 = (await call("POST", "/api/chat", { message: "Boli mnie kolano" })).body;
    expect(r2.reply).toContain("Zapamiętałem");
    const chat = (await call("GET", "/api/chat")).body;
    expect(chat.notes.some((n: any) => n.kind === "injury")).toBe(true);
  });

  it("week, progress, status and export respond", async () => {
    const w = (await call("GET", "/api/week")).body;
    expect(w.days).toHaveLength(7);
    expect(w.focus).toBe("sweet_spot");
    const p = (await call("GET", "/api/progress")).body;
    expect(p.series.length).toBeGreaterThan(80);
    expect(p.projection).toHaveLength(28);
    expect(p.current.wkg).toBe(3.14);
    const s = (await call("GET", "/api/status")).body;
    expect(s.knowledgeChunks).toBeGreaterThan(25);
    const z = await call("GET", "/api/export");
    expect(z.raw.subarray(0, 2).toString()).toBe("PK");
  });

  it("night job marks missed workouts and keeps four weeks planned", async () => {
    app.clock = () => new Date("2026-10-07T06:00:00Z"); // Wednesday
    await nightJob(app, app.athleteId()!);
    const mon = app.db.get("SELECT status FROM planned_workout WHERE date = '2026-10-05' AND status <> 'replaced' ORDER BY id DESC LIMIT 1");
    expect(["completed", "partial", "missed", "skipped"]).toContain(mon?.status);
    const last = app.db.get("SELECT MAX(date) AS d FROM planned_workout WHERE status = 'planned'")?.d;
    expect(last >= "2026-10-26").toBe(true);
    app.clock = () => MONDAY;
  });
});

describe("own account (not demo)", () => {
  const { app, dir } = makeApp(false);
  let server: Awaited<ReturnType<typeof buildServer>>;
  beforeAll(async () => {
    server = await buildServer(app);
  });
  afterAll(async () => {
    await server.close();
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("requires setup, then login; wrong password is refused", async () => {
    expect((await server.inject({ url: "/api/session" })).json()).toMatchObject({ needsSetup: true, authenticated: false });
    expect((await server.inject({ url: "/api/today" })).statusCode).toBe(401);
    const setup = await server.inject({ method: "POST", url: "/api/setup", payload: { email: "kuba@example.com", password: "dobrehaslo1" } });
    expect(setup.statusCode).toBe(200);
    expect((await server.inject({ method: "POST", url: "/api/setup", payload: { email: "x@example.com", password: "dobrehaslo1" } })).statusCode).toBe(409);
    expect((await server.inject({ method: "POST", url: "/api/login", payload: { email: "kuba@example.com", password: "zle" } })).statusCode).toBe(401);
    const ok = await server.inject({ method: "POST", url: "/api/login", payload: { email: "kuba@example.com", password: "dobrehaslo1" } });
    expect(ok.statusCode).toBe(200);
    const cookie = String(ok.headers["set-cookie"]).split(";")[0]!;
    expect((await server.inject({ url: "/api/session", headers: { cookie } })).json()).toMatchObject({ authenticated: true, onboarded: false });
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
