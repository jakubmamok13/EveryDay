import { addDays } from "@everyday/shared";
import type { App } from "../app";
import { logJob } from "../repo";
import { advanceBlocks, ensurePlan, handleMissed, maybeProposeLongRide, writeCalendar } from "./plan";
import { checkFtp, syncAll } from "./sync";

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
  });
  app.db.setMeta("last_night_job", today);
  app.db.setMeta("last_day_sync", String(app.clock().getTime()));
}

let running: Promise<"night" | "sync" | "none"> | null = null;

/** Called on open and when the app becomes visible. */
export function catchUp(app: App): Promise<"night" | "sync" | "none"> {
  running ??= (async () => {
    try {
      if (!app.onboarded()) return "none";
      const athleteId = app.athleteId();
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
    } finally {
      running = null;
    }
  })();
  return running;
}
