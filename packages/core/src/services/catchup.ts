import { addDays } from "@everyday/shared";
import type { App } from "../app";
import { logJob } from "../repo";
import { advanceBlocks, ensurePlan, handleMissed, maybeProposeLongRide, writeCalendar } from "./plan";
import { checkFtp, recomputePerformance, syncAll } from "./sync";
import { checkIn } from "../repo";
import { runMorning } from "./daily";
import { checkReturn, snapshotLadder } from "./extras";
import { analyzeStreams } from "./profile";

// No server and no night (D-043): the jobs from 03 §5 run when the app is
// opened or comes back to the screen. Every step is idempotent per day.

export async function nightJob(app: App, athleteId: number): Promise<void> {
  const today = app.today();
  await logJob(app, "night", async () => {
    await syncAll(app, athleteId, 14).catch(() => undefined);
    handleMissed(app, athleteId);
    advanceBlocks(app, athleteId);
    maybeProposeLongRide(app, athleteId);
    ensurePlan(app, athleteId);
    await writeCalendar(app, athleteId, addDays(today, -1), addDays(today, 7)).catch(() => undefined);
    await checkFtp(app, athleteId).catch(() => undefined);
    await analyzeStreams(app, athleteId).catch(() => 0);
    await checkReturn(app, athleteId).catch(() => false);
    snapshotLadder(app, athleteId);
  });
  app.db.setMeta("last_night_job", today);
  app.db.setMeta("last_day_sync", String(app.clock().getTime()));
}

/**
 * Version of the Fitness / Fatigue / Form model. A new version (D-069: other
 * sports weighted the same in both) recomputes the history and today's
 * readiness once, also after loading an older copy.
 */
const PERF_MODEL = "2";

async function upgradePerformance(app: App, athleteId: number): Promise<void> {
  if (app.db.meta("perf_model") === PERF_MODEL) return;
  recomputePerformance(app, athleteId);
  const today = app.today();
  if (app.db.get("SELECT 1 FROM daily_brief WHERE athlete_id = ? AND date = ?", athleteId, today)) {
    await runMorning(app, athleteId, today, !!checkIn(app, athleteId, today));
  }
  app.db.setMeta("perf_model", PERF_MODEL);
}

const running = new WeakMap<App, Promise<"night" | "sync" | "none">>();

/** Called on open and when the app becomes visible. One run at a time per app. */
export function catchUp(app: App): Promise<"night" | "sync" | "none"> {
  const busy = running.get(app);
  if (busy) return busy;
  const p = (async (): Promise<"night" | "sync" | "none"> => {
    if (!app.onboarded()) return "none";
    const athleteId = app.athleteId();
    await upgradePerformance(app, athleteId);
    if ((app.db.meta("last_night_job") ?? "") < app.today()) {
      await nightJob(app, athleteId);
      return "night";
    }
    // Fresh rides and wellness at most every 15 minutes.
    const last = Number(app.db.meta("last_day_sync") || 0);
    if (app.clock().getTime() - last > 15 * 60_000) {
      app.db.setMeta("last_day_sync", String(app.clock().getTime()));
      await syncAll(app, athleteId, 3).catch(() => undefined);
      await writeCalendar(app, athleteId, app.today(), addDays(app.today(), 7)).catch(() => undefined);
      return "sync";
    }
    return "none";
  })();
  running.set(app, p);
  // Cleared after the promise settles — also when it finished synchronously.
  void p.finally(() => {
    if (running.get(app) === p) running.delete(app);
  });
  return p;
}
