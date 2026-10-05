import type { ISODate } from "./dates";

export type RideMode = "indoor" | "outdoor";
export type IntensityClass = "easy" | "moderate" | "hard";
export type WorkoutCategory =
  | "recovery"
  | "endurance"
  | "tempo"
  | "sweet_spot"
  | "threshold"
  | "vo2max"
  | "anaerobic"
  | "test"
  | "long_ride";
export type BlockFocus = "sweet_spot" | "threshold" | "vo2max" | "base" | "build" | "peak" | "taper";
export type GoalType = "raise_ftp" | "endurance" | "event" | "general_fitness";
export type ReadinessState = "green" | "yellow" | "red" | "learning";
export type InputRating = "ok" | "caution" | "bad" | "missing";
export type WeekKind = "load" | "recovery" | "taper";
export type Feel = "too_easy" | "just_right" | "too_hard";
export type NoteKind = "injury" | "illness" | "travel" | "other";

// ---------- Workout Library ----------

export interface Step {
  kind: "warmup" | "work" | "recovery" | "cooldown" | "steady";
  minutes: number;
  /** Target as % of FTP. With pctHigh it is a range; with ramp it ramps pct → pctHigh. */
  pct: number;
  pctHigh?: number;
  ramp?: boolean;
  cadence?: number;
  /** Short Polish cue shown on the device / card. */
  label?: string;
  /** Steady step that stretches to fill the day's time slot (endurance rides). */
  fill?: boolean;
}

export interface RepeatBlock {
  repeat: number;
  steps: Step[];
}

export type StepOrRepeat = Step | RepeatBlock;

export interface WorkoutDef {
  slug: string;
  name: string;
  category: WorkoutCategory;
  intensity: IntensityClass;
  /** Position on the category's ladder (1 = easiest). */
  level: number;
  purpose: string;
  cue: string;
  steps: StepOrRepeat[];
  isTest?: boolean;
  /** Loose instruction for the Outdoor Variant (long rides are guidance rides). */
  outdoorGuidance?: string;
}

/** A workout scaled for one athlete and day. */
export interface ScaledWorkout {
  slug: string;
  name: string;
  category: WorkoutCategory;
  intensity: IntensityClass;
  minutes: number;
  load: number;
  steps: StepOrRepeat[];
  cue: string;
  purpose: string;
  outdoorGuidance?: string;
}

// ---------- Athlete & plan ----------

export interface AvailabilityDay {
  weekday: number; // 1 = Mon … 7 = Sun
  available: boolean;
  maxMinutes: number;
  defaultRideMode: RideMode;
  notifyTime: string; // HH:MM
}

export interface Goal {
  role: "primary" | "secondary";
  type: GoalType;
  eventName?: string;
  eventDate?: ISODate;
  priority?: "A" | "B" | "C";
  targetDistanceKm?: number;
  targetMinutes?: number;
  targetFtp?: number;
}

export interface Physiology {
  ftp: number;
  lthr: number | null;
  maxHr: number | null;
  weightKg: number | null;
}

export interface PlannedDay {
  date: ISODate;
  isKey: boolean;
  role: "quality" | "long" | "endurance" | "recovery" | "test" | "bonus" | "long_ride_day";
  workout: ScaledWorkout;
}

export interface PlannedWeek {
  weekStart: ISODate;
  kind: WeekKind;
  blockIndex: number;
  focus: BlockFocus;
  targetLoad: number;
  days: PlannedDay[];
}

// ---------- Readiness ----------

export interface WellnessDay {
  date: ISODate;
  hrv?: number | null;
  restingHr?: number | null;
  sleepSeconds?: number | null;
  sleepScore?: number | null;
  bodyBatteryMax?: number | null;
  bodyBatteryMin?: number | null;
  garminReadiness?: number | null;
  weightKg?: number | null;
}

export interface CheckIn {
  date: ISODate;
  sleepQuality: number; // 1–5
  legs: number; // 1–5
  motivation: number; // 1–5
  sick: boolean;
  pain: boolean;
  painNote?: string;
  rideMode: RideMode;
  /** "Totalne wyczerpanie" button: a red day (D-044). */
  exhausted?: boolean;
  /** The feeling button pressed (one-tap check-in, D-044). */
  feeling?: string;
}

export interface ReadinessInput {
  key: "hrv" | "rhr" | "sleep" | "body_battery" | "garmin_readiness" | "form" | "check_in" | "other_sport";
  rating: InputRating;
  value?: number | null;
  baseline?: number | null;
  detail?: string;
}

export interface Readiness {
  date: ISODate;
  score: number;
  /** Shown state; "learning" during the Learning Period. */
  state: ReadinessState;
  /** State used for decisions (never "learning"). */
  effective: Exclude<ReadinessState, "learning">;
  inputs: ReadinessInput[];
  overrides: ("sick" | "pain" | "exhausted")[];
  /** Main reason code for the brief. */
  mainReason: string;
}

export interface ChatNote {
  id?: number;
  kind: NoteKind;
  text: string;
  startDate: ISODate;
  endDate: ISODate;
}
