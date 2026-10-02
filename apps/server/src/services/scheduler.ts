import { addDays, timeToMinutes, weekday } from "@everyday/shared";
import type { App } from "../app";
import { availability, checkIn, logJob } from "../repo";
import { embedMissing, syncKnowledge } from "./coach";
import { runMorning } from "./daily";
import { backup } from "./data";
import { advanceBlocks, ensurePlan, handleMissed, maybeProposeLongRide, writeCalendar } from "./plan";
import { sendDaily } from "./push";
import { checkFtp, syncAll } from "./sync";

// Jobs and timing (03 §5). One tick per 30 s; every job is idempotent per day.

export async function nightJob(app: App, athleteId: number): Promise<void> {
  const today = app.today();
  await logJob(app, "night", async () => {
    await syncAll(app, athleteId, 14).catch(() => undefined);
    handleMissed(app, athleteId);
    advanceBlocks(app, athleteId);
    maybeProposeLongRide(app, athleteId);
    ensurePlan(app, athleteId);
    await writeCalendar(app, athleteId, today, addDays(today, 7)).catch(() => undefined);
    await checkFtp(app, athleteId).catch(() => undefined);
    syncKnowledge(app);
    await embedMissing(app).catch(() => 0);
    backup(app);
  });
  app.db.setMeta("last_night_job", today);
}

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private lastDaySync = 0;

  constructor(private readonly app: App) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 30_000);
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    const athleteId = this.app.athleteId();
    if (!athleteId || !this.app.db.get("SELECT onboarded FROM athlete WHERE id = ?", athleteId)?.onboarded) return;
    this.busy = true;
    try {
      const now = this.app.now();
      // Night job at 03:00, or as catch-up after the PC was off (08 §1).
      if ((this.app.db.meta("last_night_job") ?? "") < now.date && now.minutes >= 180) {
        await nightJob(this.app, athleteId);
      }
      // Day sync every 15 minutes, 05:00–23:00.
      if (now.minutes >= 300 && now.minutes < 1380 && Date.now() - this.lastDaySync > 15 * 60_000) {
        this.lastDaySync = Date.now();
        await syncAll(this.app, athleteId, 3).catch(() => undefined);
      }
      // Daily notification at the per-day time (D-034).
      const day = availability(this.app, athleteId).days.find((d) => d.weekday === weekday(now.date));
      const notifyAt = timeToMinutes(day?.notifyTime ?? "07:00");
      if (now.minutes >= notifyAt) {
        await sendDaily(this.app, athleteId);
        // No check-in 2 h later → brief from Garmin data only (R8-16).
        const hasBrief = this.app.db.get("SELECT 1 FROM daily_brief WHERE athlete_id = ? AND date = ?", athleteId, now.date);
        if (!hasBrief && now.minutes >= notifyAt + 120 && !checkIn(this.app, athleteId, now.date)) {
          await runMorning(this.app, athleteId, now.date, false);
        }
      }
    } catch (e) {
      console.error("[scheduler]", (e as Error).message);
    } finally {
      this.busy = false;
    }
  }
}
