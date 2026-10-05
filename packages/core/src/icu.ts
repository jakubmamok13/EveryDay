import type { ISODate } from "@everyday/shared";
import type { RideSource } from "@everyday/engine";

// intervals.icu client (07 §5). Field names are mapped defensively and the raw
// record is kept, because the exact names are confirmed in spike S05.

export interface IcuAthlete {
  id: string;
  name: string | null;
  ftp: number | null;
  lthr: number | null;
  maxHr: number | null;
  weightKg: number | null;
  eftp: number | null;
}

export interface IcuActivity {
  id: string;
  startLocal: string; // "YYYY-MM-DDTHH:MM:SS"
  type: string;
  name: string | null;
  source: RideSource;
  indoor: boolean;
  movingSeconds: number;
  distanceM: number | null;
  elevationM: number | null;
  avgPower: number | null;
  weightedPower: number | null;
  avgHr: number | null;
  maxHr: number | null;
  load: number | null;
  best1min: number | null;
  best20min: number | null;
  /** Strava-sourced stub without data (07: never rely on Strava → intervals.icu). */
  stub: boolean;
  raw: unknown;
}

export interface IcuWellness {
  date: ISODate;
  hrv: number | null;
  restingHr: number | null;
  sleepSeconds: number | null;
  sleepScore: number | null;
  bodyBatteryMax: number | null;
  bodyBatteryMin: number | null;
  readiness: number | null;
  stress: number | null;
  weightKg: number | null;
  raw: unknown;
}

export interface IcuWorkoutEvent {
  date: ISODate;
  name: string;
  description: string;
  minutes: number;
  load: number;
  indoor: boolean;
}

export interface IcuClient {
  readonly kind: "real" | "demo";
  athlete(): Promise<IcuAthlete>;
  activities(oldest: ISODate, newest: ISODate): Promise<IcuActivity[]>;
  wellness(oldest: ISODate, newest: ISODate): Promise<IcuWellness[]>;
  createWorkout(ev: IcuWorkoutEvent): Promise<string>;
  updateWorkout(id: string, ev: IcuWorkoutEvent): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function pick(o: any, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = num(o?.[k]);
    if (v !== null) return v;
  }
  return null;
}

export function mapSource(a: any): RideSource {
  const s = `${a?.source ?? ""} ${a?.device_name ?? ""} ${a?.external_id ?? ""}`.toLowerCase();
  if (s.includes("mywhoosh") || s.includes("whoosh")) return "mywhoosh";
  if (s.includes("wahoo") || s.includes("elemnt") || s.includes("bolt")) return "bolt";
  if (s.includes("garmin") || s.includes("fenix")) return "fenix";
  if (s.includes("upload") || s.includes("manual")) return "upload";
  return "other";
}

export function mapActivity(a: any): IcuActivity {
  const type = String(a?.type ?? "Ride");
  const source = mapSource(a);
  const stub = String(a?.source ?? "").toUpperCase() === "STRAVA" && num(a?.moving_time) === null;
  return {
    id: String(a.id),
    startLocal: String(a.start_date_local ?? a.start_date ?? ""),
    type,
    name: a?.name ?? null,
    source,
    indoor: type === "VirtualRide" || !!a?.trainer || source === "mywhoosh",
    movingSeconds: pick(a, "moving_time", "elapsed_time", "icu_recording_time") ?? 0,
    distanceM: pick(a, "distance", "icu_distance"),
    elevationM: pick(a, "total_elevation_gain"),
    avgPower: pick(a, "icu_average_watts", "average_watts"),
    weightedPower: pick(a, "icu_weighted_avg_watts", "weighted_average_watts"),
    avgHr: pick(a, "average_heartrate"),
    maxHr: pick(a, "max_heartrate"),
    load: pick(a, "icu_training_load", "training_load"),
    best1min: pick(a, "icu_best_1min_watts", "best_1min"),
    best20min: pick(a, "icu_best_20min_watts", "best_20min"),
    stub,
    raw: a,
  };
}

export function mapWellness(w: any): IcuWellness {
  return {
    date: String(w.id ?? w.date),
    hrv: pick(w, "hrv", "hrvSDNN"),
    restingHr: pick(w, "restingHR", "resting_hr"),
    sleepSeconds: pick(w, "sleepSecs", "sleep_secs"),
    sleepScore: pick(w, "sleepScore", "sleepQuality"),
    bodyBatteryMax: pick(w, "BodyBatteryMax", "bodyBatteryMax", "BodyBattery"),
    bodyBatteryMin: pick(w, "BodyBatteryMin", "bodyBatteryMin"),
    readiness: pick(w, "readiness", "TrainingReadiness"),
    stress: pick(w, "stress", "avgStress"),
    weightKg: pick(w, "weight"),
    raw: w,
  };
}

export class RealIcuClient implements IcuClient {
  readonly kind = "real" as const;
  private readonly auth: string;
  constructor(apiKey: string, private readonly athleteId = "0", private readonly base = "https://intervals.icu/api/v1") {
    this.auth = "Basic " + btoa(`API_KEY:${apiKey}`);
  }

  private async req(method: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(this.base + path, {
      method,
      headers: { authorization: this.auth, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error("intervals.icu: auth"), { code: "auth_error" });
    if (!res.ok) throw Object.assign(new Error(`intervals.icu ${method} ${path} → ${res.status}`), { code: "http_" + res.status });
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async athlete(): Promise<IcuAthlete> {
    const a = await this.req("GET", `/athlete/${this.athleteId}`);
    const ride = (a?.sportSettings ?? []).find((s: any) => (s.types ?? []).includes("Ride")) ?? a?.sportSettings?.[0];
    return {
      id: String(a?.id ?? this.athleteId),
      name: a?.name ?? null,
      ftp: pick(ride, "ftp", "indoor_ftp"),
      lthr: pick(ride, "lthr"),
      maxHr: pick(ride, "max_hr"),
      weightKg: pick(a, "icu_weight", "weight"),
      eftp: pick(ride, "eFtp", "icu_eftp", "eftp") ?? pick(a, "icu_eftp"),
    };
  }

  async activities(oldest: ISODate, newest: ISODate): Promise<IcuActivity[]> {
    const list = await this.req("GET", `/athlete/${this.athleteId}/activities?oldest=${oldest}&newest=${newest}`);
    // All sports (D-047): rides build the plan; other sports count in the load.
    return (list ?? []).map(mapActivity);
  }

  async wellness(oldest: ISODate, newest: ISODate): Promise<IcuWellness[]> {
    const list = await this.req("GET", `/athlete/${this.athleteId}/wellness?oldest=${oldest}&newest=${newest}`);
    return (list ?? []).map(mapWellness);
  }

  private eventBody(ev: IcuWorkoutEvent) {
    return {
      category: "WORKOUT",
      start_date_local: `${ev.date}T00:00:00`,
      type: ev.indoor ? "VirtualRide" : "Ride",
      name: ev.name,
      description: ev.description,
      moving_time: Math.round(ev.minutes * 60),
      icu_training_load: Math.round(ev.load),
    };
  }

  async createWorkout(ev: IcuWorkoutEvent): Promise<string> {
    const out = await this.req("POST", `/athlete/${this.athleteId}/events`, this.eventBody(ev));
    return String(out?.id);
  }

  async updateWorkout(id: string, ev: IcuWorkoutEvent): Promise<void> {
    await this.req("PUT", `/athlete/${this.athleteId}/events/${id}`, this.eventBody(ev));
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.req("DELETE", `/athlete/${this.athleteId}/events/${id}`);
  }
}
