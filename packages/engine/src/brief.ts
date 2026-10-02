import {
  addDays,
  WEEKDAY_PL_LONG,
  weekday,
  type ISODate,
  type Physiology,
  type PlannedDay,
  type Readiness,
  type ReadinessState,
  type RideMode,
  type ScaledWorkout,
} from "@everyday/shared";
import { fueling, type Fueling } from "./progress";
import type { AdaptResult } from "./rules";
import { CHANGE_REASON, READINESS_EMOJI, READINESS_WORD, readinessReason } from "./texts";
import { isRepeat, mainTargetText } from "./workouts";

// Daily Brief facts + fixed-format template (02 M6). The engine owns every number.

export interface BriefFacts {
  date: ISODate;
  restDay: boolean;
  withCheckIn: boolean;
  readiness: { state: ReadinessState; score: number; emoji: string; word: string; reason: string };
  workout?: {
    name: string;
    minutes: number;
    rideMode: RideMode;
    modeLabel: string;
    target: string;
    category: string;
    intensity: string;
    purpose: string;
  };
  change?: { action: string; text: string };
  fueling?: Fueling;
  tomorrow: string;
  /** Template texts for the three AI slots. */
  templates: { focus: string; offBike: string; change?: string };
  /** Every number the AI may use. */
  numbers: string[];
}

export interface BriefInput {
  date: ISODate;
  readiness: Readiness;
  withCheckIn: boolean;
  today: PlannedDay | null;
  /** Today's workout before adaptation (for the change line). */
  before?: PlannedDay | null;
  adaptation?: AdaptResult | null;
  rideMode: RideMode;
  physiology: Physiology;
  upcoming: PlannedDay[];
  gutLevel?: number;
}

const MODE_LABEL: Record<RideMode, string> = { indoor: "W domu (MyWhoosh)", outdoor: "Na zewnątrz (BOLT / Fenix)" };

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function minutesText(m: number): string {
  if (m < 90) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function tomorrowLine(date: ISODate, upcoming: PlannedDay[]): string {
  const next = upcoming.filter((d) => d.date > date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const tomorrow = next.find((d) => d.date === addDays(date, 1));
  const withTime = (d: PlannedDay) => (/\d+ (h|min)\b/.test(d.workout.name) ? d.workout.name : `${d.workout.name} · ${minutesText(d.workout.minutes)}`);
  if (tomorrow) return `${withTime(tomorrow)}.`;
  const later = next.find((d) => d.date <= addDays(date, 6));
  return later ? `wolne. ${cap(WEEKDAY_PL_LONG[weekday(later.date)]!)}: ${later.workout.name}.` : "wolne.";
}

function changeText(input: BriefInput): string | undefined {
  const a = input.adaptation;
  const before = input.before?.workout;
  if (!a || a.action === "keep" || !before) return undefined;
  const why = a.reasons.map((r) => CHANGE_REASON[r]).filter(Boolean)[0] ?? "";
  const tail = why ? ` — ${why}` : "";
  switch (a.action) {
    case "reduce": {
      const b = before.steps.find(isRepeat);
      const n = a.workout?.steps.find(isRepeat);
      return b && n && n.repeat < b.repeat
        ? `jedno powtórzenie mniej (${n.repeat} zamiast ${b.repeat})${tail}.`
        : `moc w blokach niższa o 3%${tail}.`;
    }
    case "shorten":
      return `skróciłem do ${a.workout?.minutes ?? 0} min, spokojnie w Z2${tail}.`;
    case "recovery":
      return `zamiast „${before.name}” regeneracja ${a.workout?.minutes ?? 0} min${tail}.`;
    case "rest":
      return `dziś odpoczynek zamiast „${before.name}”${tail}.`;
    case "swap":
      return `zamiana z ${WEEKDAY_PL_LONG[weekday(a.swapWith!)]}: dziś spokojnie, „${before.name}” później${tail}.`;
  }
  return undefined;
}

function offBike(input: BriefInput, w: ScaledWorkout | undefined, state: Readiness["effective"]): string {
  const tomorrow = input.upcoming.find((d) => d.date === addDays(input.date, 1));
  if (state === "red" || input.readiness.overrides.includes("sick")) return "dziś priorytet: sen 8 h i dużo picia.";
  if (tomorrow && tomorrow.workout.minutes > 150) {
    const f = fueling(tomorrow.workout.minutes, input.gutLevel ?? 0);
    const bars = f ? Math.ceil((tomorrow.workout.minutes / 60) * (f.carbsPerHour / 30)) : 4;
    return `przygotuj bidony i ok. ${bars} żeli lub batonów (po ok. 30 g) na jutrzejszą długą jazdę.`;
  }
  if (!w) return "10 minut rozciągania bioder i pleców.";
  if (w.category === "long_ride") return "do 30 minut po jeździe posiłek z węglowodanami i białkiem.";
  if (w.intensity === "hard") return "kolacja z porcją węglowodanów i sen przed 23:00.";
  return "sen przed 23:00 i 2 litry wody w ciągu dnia.";
}

export function buildBriefFacts(input: BriefInput): BriefFacts {
  const r = input.readiness;
  const w = input.today?.workout;
  const facts: BriefFacts = {
    date: input.date,
    restDay: !w,
    withCheckIn: input.withCheckIn,
    readiness: {
      state: r.state,
      score: r.score,
      emoji: READINESS_EMOJI[r.state],
      word: READINESS_WORD[r.state],
      reason: readinessReason(r, input.withCheckIn),
    },
    tomorrow: tomorrowLine(input.date, input.upcoming),
    templates: { focus: "", offBike: offBike(input, w, r.effective) },
    numbers: [],
  };
  if (w) {
    const target = mainTargetText(w, input.physiology, input.rideMode);
    facts.workout = {
      name: w.name,
      minutes: w.minutes,
      rideMode: input.rideMode,
      modeLabel: MODE_LABEL[input.rideMode],
      target,
      category: w.category,
      intensity: w.intensity,
      purpose: w.purpose,
    };
    facts.templates.focus = w.cue.replace("{target}", target || "spokojnie");
    const f = fueling(w.minutes, input.gutLevel ?? 0);
    if (f) facts.fueling = f;
  } else {
    facts.templates.focus = "";
  }
  const change = changeText(input);
  if (change) {
    facts.change = { action: input.adaptation!.action, text: change };
    facts.templates.change = change;
  }
  facts.numbers = collectNumbers(facts);
  return facts;
}

function collectNumbers(f: BriefFacts): string[] {
  const text = JSON.stringify({ ...f, numbers: undefined });
  return [...new Set(text.match(/\d+(?:[.,]\d+)?/g) ?? [])];
}

export interface BriefSlots {
  focus?: string;
  offBike?: string;
  change?: string;
}

export interface BriefLine {
  key: "today" | "readiness" | "focus" | "change" | "fueling" | "offBike" | "tomorrow";
  label: string;
  text: string;
}

/** Fixed brief format; AI slots replace the templates when given (and validated). */
export function assembleBrief(f: BriefFacts, slots: BriefSlots = {}): { lines: BriefLine[]; text: string } {
  const lines: BriefLine[] = [];
  lines.push({
    key: "today",
    label: "Dziś",
    text: f.workout
      ? `${/\d+ (h|min)\b/.test(f.workout.name) && !/×/.test(f.workout.name) ? f.workout.name : `${f.workout.name} · ${minutesText(f.workout.minutes)}`} · ${f.workout.modeLabel}`
      : "dzień wolny",
  });
  lines.push({ key: "readiness", label: "Gotowość", text: `${f.readiness.emoji} ${f.readiness.word} — ${f.readiness.reason}` });
  if (f.workout) lines.push({ key: "focus", label: "Skup się", text: cap(slots.focus ?? f.templates.focus) });
  if (f.change) lines.push({ key: "change", label: "Zmiana", text: cap(slots.change ?? f.templates.change ?? f.change.text) });
  if (f.fueling) {
    lines.push({
      key: "fueling",
      label: "Jedzenie",
      text: `${f.fueling.carbsPerHour} g węglowodanów/h, ${f.fueling.fluidLow}–${f.fueling.fluidHigh} ml płynów/h`,
    });
  }
  lines.push({ key: "offBike", label: "Poza rowerem", text: cap(slots.offBike ?? f.templates.offBike) });
  lines.push({ key: "tomorrow", label: "Jutro", text: cap(f.tomorrow) });
  return { lines, text: lines.map((l) => `${l.label}: ${l.text}`).join("\n") };
}
