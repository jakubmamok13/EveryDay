import { addDays, weekday, type ISODate } from "@everyday/shared";
import type { IcuActivity, IcuAthlete, IcuClient, IcuWellness, IcuWorkoutEvent } from "./icu";

// Demo mode: a deterministic stand-in for intervals.icu with ~4 months of
// realistic rides (incl. duplicates) and wellness. Workouts written to the
// "calendar" in the past are turned into completed rides, so the demo lives.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface StoredEvent extends IcuWorkoutEvent {
  id: string;
}

export class FakeIcuClient implements IcuClient {
  readonly kind = "demo" as const;
  private readonly events = new Map<string, StoredEvent>();
  /** Activities handed out by activities(), for powerStream(). */
  private readonly seen = new Map<string, IcuActivity>();
  private nextId = 1;
  constructor(private readonly today: () => ISODate, private readonly ftp = 250) {}

  async athlete(): Promise<IcuAthlete> {
    return { id: "demo", name: "Demo", ftp: this.ftp, lthr: 162, maxHr: 184, weightKg: 75, eftp: 256 };
  }

  private historyFor(date: ISODate): IcuActivity[] {
    const r = rng(Number(date.replace(/-/g, "")));
    const wd = weekday(date);
    const out: IcuActivity[] = [];
    const mk = (id: string, hour: number, minutes: number, indoor: boolean, source: IcuActivity["source"], intensity: number, withPower: boolean): IcuActivity => {
      const wp = Math.round(this.ftp * intensity);
      const secs = minutes * 60;
      const load = Math.round((secs * wp * (wp / this.ftp)) / (this.ftp * 3600) * 100);
      return {
        id,
        startLocal: `${date}T${String(hour).padStart(2, "0")}:${source === "fenix" ? "01" : "00"}:00`,
        type: indoor ? "VirtualRide" : "Ride",
        name: indoor ? "MyWhoosh" : "Jazda",
        source,
        indoor,
        movingSeconds: secs - (source === "fenix" ? 40 : 0),
        distanceM: Math.round(minutes * (indoor ? 520 : 470)),
        elevationM: indoor ? 0 : Math.round(minutes * 4),
        avgPower: withPower ? Math.round(wp * 0.93) : null,
        weightedPower: withPower ? wp : null,
        avgHr: Math.round(120 + 40 * intensity),
        maxHr: Math.round(140 + 45 * intensity),
        load: withPower ? load : Math.round(load * 0.95),
        best1min: withPower ? Math.round(wp * 1.35) : null,
        best20min: withPower ? Math.round(this.ftp * (intensity > 0.8 ? 1.0 : 0.85)) : null,
        stub: false,
        raw: { demo: true },
      };
    };
    if ((wd === 2 || wd === 4) && r() > 0.12) {
      const ints = 0.78 + r() * 0.08;
      out.push(mk(`d${date}-mw`, 18, 60, true, "mywhoosh", ints, true));
      out.push(mk(`d${date}-fx`, 18, 60, true, "fenix", ints, false));
    }
    // Every other Saturday a 3 h indoor ride with power (durability data, B5).
    const isoWeek = Math.floor((Date.parse(date) / 86_400_000 + 3) / 7);
    if (wd === 6 && isoWeek % 2 === 0 && r() > 0.1) {
      out.push(mk(`d${date}-mwl`, 9, 180, true, "mywhoosh", 0.7, true));
    } else if (wd === 6 && r() > 0.1) {
      const m = 120 + Math.round(r() * 4) * 15;
      out.push(mk(`d${date}-bolt`, 9, m, false, "bolt", 0.68, false));
      out.push(mk(`d${date}-fx`, 9, m + 2, false, "fenix", 0.68, false));
    }
    if (wd === 7 && r() > 0.25) out.push(mk(`d${date}-bolt`, 10, 75 + Math.round(r() * 3) * 15, false, "bolt", 0.65, false));
    // Other sports (D-047): strength on Wednesday, an easy run on Friday.
    const other = (id: string, type: string, name: string, minutes: number, load: number | null): IcuActivity => ({
      id, startLocal: `${date}T19:00:00`, type, name, source: "fenix", indoor: false, movingSeconds: minutes * 60,
      distanceM: type === "Run" ? minutes * 180 : null, elevationM: null, avgPower: null, weightedPower: null,
      avgHr: type === "Run" ? 148 : 105, maxHr: type === "Run" ? 165 : 140, load, best1min: null, best20min: null, stub: false, raw: { demo: true },
    });
    if (wd === 3 && r() > 0.3) out.push(other(`d${date}-gym`, "WeightTraining", "Siłownia", 50, 18));
    if (wd === 5 && r() > 0.4) out.push(other(`d${date}-run`, "Run", "Bieg", 35, 38));
    return out;
  }

  private fromEvent(ev: StoredEvent): IcuActivity {
    const r = rng(Number(ev.date.replace(/-/g, "")) + 7);
    const done = 0.9 + r() * 0.12;
    const minutes = Math.round(ev.minutes * Math.min(1, done));
    const intensity = Math.sqrt(Math.max(ev.load, 1) / Math.max(ev.minutes / 60, 0.1) / 100) * (0.97 + r() * 0.05);
    const wp = Math.round(this.ftp * intensity);
    return {
      id: `e${ev.id}`,
      startLocal: `${ev.date}T${ev.indoor ? "18" : "09"}:00:00`,
      type: ev.indoor ? "VirtualRide" : "Ride",
      name: ev.name,
      source: ev.indoor ? "mywhoosh" : "bolt",
      indoor: ev.indoor,
      movingSeconds: minutes * 60,
      distanceM: minutes * 500,
      elevationM: ev.indoor ? 0 : minutes * 4,
      avgPower: ev.indoor ? Math.round(wp * 0.92) : null,
      weightedPower: ev.indoor ? wp : null,
      avgHr: Math.round(115 + 45 * intensity),
      maxHr: Math.round(140 + 45 * intensity),
      load: Math.round(ev.load * done),
      best1min: ev.indoor ? Math.round(wp * 1.4) : null,
      best20min: ev.indoor ? Math.round(wp * 1.02) : null,
      stub: false,
      raw: { demo: true, event: ev.id },
    };
  }

  async activities(oldest: ISODate, newest: ISODate): Promise<IcuActivity[]> {
    const today = this.today();
    const out: IcuActivity[] = [];
    const planned = [...this.events.values()].filter((e) => e.date < today);
    const plannedDates = new Set(planned.map((e) => e.date));
    for (let d = oldest; d <= newest && d < today; d = addDays(d, 1)) {
      if (plannedDates.has(d)) continue;
      out.push(...this.historyFor(d));
    }
    for (const e of planned) if (e.date >= oldest && e.date <= newest) out.push(this.fromEvent(e));
    for (const a of out) this.seen.set(a.id, a);
    return out;
  }

  /** Deterministic 1 Hz power: warm-up, intervals or a steady ride with a hard finish. */
  async powerStream(activityId: string): Promise<number[] | null> {
    const a = this.seen.get(activityId);
    if (!a || !a.weightedPower) return null;
    const r = rng(Number(a.startLocal.slice(0, 10).replace(/-/g, "")) + 3);
    const ftp = this.ftp;
    const out: number[] = [];
    const block = (sec: number, w: number) => {
      for (let i = 0; i < sec; i++) out.push(Math.round(w * (0.97 + r() * 0.06)));
    };
    const total = a.movingSeconds;
    if (total >= 150 * 60) {
      block(total - 20 * 60, ftp * 0.68);
      block(20 * 60, ftp * (0.86 + r() * 0.04)); // strong finish after ~20 kJ/kg
      return out;
    }
    block(10 * 60, ftp * 0.6);
    block(15, ftp * (2.9 + r() * 0.4)); // sprint
    block(5 * 60, ftp * 0.6);
    block(60, ftp * (1.35 + r() * 0.1));
    block(4 * 60, ftp * 0.55);
    block(5 * 60, ftp * (1.08 + r() * 0.06));
    block(4 * 60, ftp * 0.55);
    while (out.length < total - 5 * 60) block(Math.min(10 * 60, total - 5 * 60 - out.length), Math.min(ftp * 0.95, a.weightedPower * 1.02));
    block(Math.max(0, total - out.length), ftp * 0.5);
    return out;
  }

  async wellness(oldest: ISODate, newest: ISODate): Promise<IcuWellness[]> {
    const out: IcuWellness[] = [];
    const today = this.today();
    for (let d = oldest; d <= newest && d <= today; d = addDays(d, 1)) {
      const r = rng(Number(d.replace(/-/g, "")) + 99);
      out.push({
        date: d,
        hrv: Math.round(56 + (r() - 0.5) * 12),
        restingHr: Math.round(49 + (r() - 0.5) * 4),
        sleepSeconds: Math.round((6.6 + r() * 1.6) * 3600),
        sleepScore: Math.round(65 + r() * 30),
        bodyBatteryMax: Math.round(55 + r() * 40),
        bodyBatteryMin: Math.round(10 + r() * 20),
        readiness: Math.round(45 + r() * 50),
        stress: Math.round(20 + r() * 20),
        weightKg: 75,
        raw: { demo: true },
      });
    }
    return out;
  }

  async createWorkout(ev: IcuWorkoutEvent): Promise<string> {
    const id = String(this.nextId++);
    this.events.set(id, { ...ev, id });
    return id;
  }
  async updateWorkout(id: string, ev: IcuWorkoutEvent): Promise<void> {
    this.events.set(id, { ...ev, id });
  }
  async deleteWorkout(id: string): Promise<void> {
    this.events.delete(id);
  }
}
