import { addDays, type ISODate, type WorkoutCategory } from "@everyday/shared";
import {
  durabilityFromWatts,
  durabilitySummary,
  peaksFromWatts,
  powerProfile,
  type DurabilitySummary,
  type Peaks,
  type PowerProfile,
  type RideDurability,
  type Sex,
} from "@everyday/engine";
import type { App } from "../app";
import { goals, physiologyOn } from "../repo";

// B3 power profile + B5 durability, computed on the phone from 1 Hz power
// streams of rides with power (one request per ride, cached in activity.peaks_json).

interface StoredPeaks extends Peaks {
  dur: RideDurability | null;
}

/** Fetch and analyse power streams of recent rides (newest first, a few per run). */
export async function analyzeStreams(app: App, athleteId: number, limit = 12): Promise<number> {
  const icu = app.icu();
  if (!icu) return 0;
  const rows = app.db.all<{ id: number; icu_id: string; date: ISODate; moving_seconds: number }>(
    `SELECT id, icu_id, date, moving_seconds FROM activity WHERE athlete_id = ? AND sport = 'ride' AND is_master = 1
     AND weighted_power IS NOT NULL AND streams_done = 0 AND date >= ? ORDER BY date DESC LIMIT ?`,
    athleteId, addDays(app.today(), -84), limit,
  );
  let done = 0;
  for (const r of rows) {
    let watts: number[] | null = null;
    try {
      watts = await icu.powerStream(r.icu_id);
    } catch {
      break; // offline or rate-limited: try again next time
    }
    const weight = physiologyOn(app, athleteId, r.date).weightKg;
    const stored: StoredPeaks | null = watts
      ? { ...peaksFromWatts(watts), dur: weight && r.moving_seconds >= 2 * 3600 ? durabilityFromWatts(watts, weight) : null }
      : null;
    app.db.run("UPDATE activity SET peaks_json = ?, streams_done = 1 WHERE id = ?", stored ? JSON.stringify(stored) : null, r.id);
    done++;
  }
  return done;
}

function storedPeaks(app: App, athleteId: number, days: number): StoredPeaks[] {
  return app.db
    .all<{ peaks_json: string }>(
      "SELECT peaks_json FROM activity WHERE athlete_id = ? AND sport = 'ride' AND peaks_json IS NOT NULL AND date >= ?",
      athleteId, addDays(app.today(), -days),
    )
    .map((r) => JSON.parse(r.peaks_json) as StoredPeaks);
}

/** Best 5 s / 1 / 5 / 20 min power of the last `days` days. */
export function bestPeaks(app: App, athleteId: number, days = 84): Peaks & { rides: number } {
  const list = storedPeaks(app, athleteId, days);
  const max = (k: keyof Peaks) => {
    const v = Math.max(0, ...list.map((p) => p[k] ?? 0));
    return v > 0 ? v : null;
  };
  return { p5: max("p5"), p60: max("p60"), p300: max("p300"), p1200: max("p1200"), rides: list.length };
}

export function sexOf(app: App, athleteId: number): Sex {
  return app.db.get<{ sex: string | null }>("SELECT sex FROM athlete WHERE id = ?", athleteId)?.sex === "f" ? "f" : "m";
}

export function profileView(app: App, athleteId: number): (PowerProfile & { rides: number }) | { rides: number; missing: string } {
  const peaks = bestPeaks(app, athleteId);
  const phys = physiologyOn(app, athleteId, app.today());
  const p = powerProfile(peaks, phys.ftp, phys.weightKg, sexOf(app, athleteId));
  if (!p) {
    return {
      rides: peaks.rides,
      missing: phys.weightKg
        ? "Za mało jazd z pomiarem mocy w ostatnich 12 tygodniach (potrzebny sprint, 1 min i 5 min — np. z treningów VO2max na trenażerze)."
        : "Podaj wagę w Ustawieniach › Profil.",
    };
  }
  return { ...p, rides: peaks.rides };
}

/** Aerobic weakness that steers the second quality slot (raise-FTP goal only). */
export function weaknessCategory(app: App, athleteId: number): WorkoutCategory | null {
  if (!goals(app, athleteId).some((g) => g.role === "primary" && g.type === "raise_ftp")) return null;
  const v = profileView(app, athleteId);
  return "focusCategory" in v ? v.focusCategory : null;
}

export function durabilityView(app: App, athleteId: number): DurabilitySummary {
  const list = storedPeaks(app, athleteId, 84);
  const best = bestPeaks(app, athleteId);
  return durabilitySummary({ p300: best.p300, p1200: best.p1200 }, list.map((p) => p.dur).filter((d): d is RideDurability => !!d));
}
