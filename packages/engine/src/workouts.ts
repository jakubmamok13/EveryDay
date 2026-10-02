import type { Physiology, RepeatBlock, RideMode, ScaledWorkout, Step, StepOrRepeat, WorkoutDef } from "@everyday/shared";
import { hrRange, hrZoneForPowerZone, powerZone, rpeForZone, watts } from "./zones";

export function isRepeat(s: StepOrRepeat): s is RepeatBlock {
  return (s as RepeatBlock).repeat !== undefined;
}

export function flatten(steps: StepOrRepeat[]): Step[] {
  const out: Step[] = [];
  for (const s of steps) {
    if (isRepeat(s)) for (let i = 0; i < s.repeat; i++) out.push(...s.steps);
    else out.push(s);
  }
  return out;
}

export function totalMinutes(steps: StepOrRepeat[]): number {
  return flatten(steps).reduce((m, s) => m + s.minutes, 0);
}

/** Mean of IF² over a step (ramps integrate linearly). */
function stepIntensitySquared(s: Step): number {
  const a = s.pct / 100;
  if (s.pctHigh === undefined) return a * a;
  const b = s.pctHigh / 100;
  if (s.ramp) return (a * a + a * b + b * b) / 3;
  const mid = (a + b) / 2;
  return mid * mid;
}

/** Planned Load: Σ hours × IF² × 100 (step-wise, like planned TSS). */
export function estimateLoad(steps: StepOrRepeat[]): number {
  return flatten(steps).reduce((l, s) => l + (s.minutes / 60) * stepIntensitySquared(s) * 100, 0);
}

export function maxPct(steps: StepOrRepeat[]): number {
  return flatten(steps).reduce((m, s) => Math.max(m, s.pctHigh ?? s.pct), 0);
}

/** Main work step: the longest-total step type above the warm-up intensity. */
export function mainWorkStep(steps: StepOrRepeat[]): Step | undefined {
  const work = flatten(steps).filter((s) => s.kind === "work" || s.kind === "steady");
  if (work.length === 0) return undefined;
  return work.reduce((best, s) => ((s.pctHigh ?? s.pct) > (best.pctHigh ?? best.pct) ? s : best));
}

function cloneSteps(steps: StepOrRepeat[]): StepOrRepeat[] {
  return steps.map((s) => (isRepeat(s) ? { repeat: s.repeat, steps: s.steps.map((x) => ({ ...x })) } : { ...s }));
}

export interface ScaleOptions {
  /** Stretch the `fill` step so the workout lasts this long. */
  targetMinutes?: number;
  /** Override the repeat count of the first repeat block. */
  repeats?: number;
}

export function scaleWorkout(def: WorkoutDef, opts: ScaleOptions = {}): ScaledWorkout {
  const steps = cloneSteps(def.steps);
  if (opts.repeats !== undefined) {
    const block = steps.find(isRepeat);
    if (block) block.repeat = Math.max(1, opts.repeats);
  }
  if (opts.targetMinutes !== undefined) {
    const fill = steps.find((s): s is Step => !isRepeat(s) && !!s.fill);
    if (fill) {
      const others = totalMinutes(steps) - fill.minutes;
      fill.minutes = Math.max(10, Math.round(opts.targetMinutes - others));
    }
  }
  return {
    slug: def.slug,
    name: workoutName(def, steps),
    category: def.category,
    intensity: def.intensity,
    minutes: Math.round(totalMinutes(steps)),
    load: Math.round(estimateLoad(steps)),
    steps,
    cue: def.cue,
    purpose: def.purpose,
    ...(def.outdoorGuidance ? { outdoorGuidance: def.outdoorGuidance } : {}),
  };
}

/** Names like "Sweet Spot 3×12 min" follow the actual repeat count; endurance names get the duration. */
function workoutName(def: WorkoutDef, steps: StepOrRepeat[]): string {
  const block = steps.find(isRepeat);
  if (def.name.includes("{n}") && block) return def.name.replace("{n}", String(block.repeat));
  if (def.name.includes("{h}")) {
    const m = Math.round(totalMinutes(steps));
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return def.name.replace("{h}", rest === 0 ? `${h} h` : h === 0 ? `${rest} min` : `${h} h ${rest} min`);
  }
  return def.name;
}

/**
 * Shorten to at most `minutes`: stretchable rides shrink their fill step,
 * interval sessions lose repeats, and as a last resort it becomes an easy Z2 ride.
 */
export function shortenTo(w: ScaledWorkout, minutes: number, def?: WorkoutDef): ScaledWorkout {
  if (w.minutes <= minutes) return w;
  const steps = cloneSteps(w.steps);
  const fill = steps.find((s): s is Step => !isRepeat(s) && !!s.fill);
  if (fill) {
    fill.minutes = Math.max(10, fill.minutes - (w.minutes - minutes));
    const out = restamp(w, steps);
    if (def) return { ...out, name: scaleWorkout(def, { targetMinutes: out.minutes }).name };
    return out;
  }
  const block = steps.find(isRepeat);
  if (block) {
    while (block.repeat > 1 && totalMinutes(steps) > minutes) block.repeat -= 1;
    if (totalMinutes(steps) <= minutes) return restamp(w, steps);
  }
  return shortenAndCap(w, minutes / w.minutes);
}

/** Easier version for a Yellow day: one repeat less, or −3% on work steps. */
export function reduceWorkout(w: ScaledWorkout): ScaledWorkout {
  const steps = cloneSteps(w.steps);
  const block = steps.find(isRepeat);
  if (block && block.repeat > 2) {
    block.repeat -= 1;
  } else {
    for (const s of flatten(steps)) {
      if (s.kind === "work") {
        s.pct = Math.round(s.pct * 0.97);
        if (s.pctHigh) s.pctHigh = Math.round(s.pctHigh * 0.97);
      }
    }
  }
  return restamp(w, steps);
}

/** Shorter (by `factor`) and capped at Endurance (Z2). */
export function shortenAndCap(w: ScaledWorkout, factor: number, capPct = 75): ScaledWorkout {
  const target = Math.max(20, Math.round(w.minutes * factor));
  const steps: StepOrRepeat[] = [
    { kind: "warmup", minutes: 10, pct: 50, pctHigh: 65, ramp: true, label: "Rozgrzewka" },
    { kind: "steady", minutes: Math.max(5, target - 15), pct: Math.min(65, capPct), pctHigh: Math.min(72, capPct), label: "Spokojnie Z2" },
    { kind: "cooldown", minutes: 5, pct: 50, label: "Schłodzenie" },
  ];
  return {
    ...restamp(w, steps),
    slug: "endurance-capped",
    name: `Spokojna jazda ${target} min`,
    category: "endurance",
    intensity: "easy",
    cue: "luźno w Z2 ({target}), oddech nosem, bez gonienia.",
  };
}

export function restamp(w: ScaledWorkout, steps: StepOrRepeat[]): ScaledWorkout {
  const block = steps.find(isRepeat);
  const name = block ? w.name.replace(/\d+×/, `${block.repeat}×`) : w.name;
  return { ...w, name, steps, minutes: Math.round(totalMinutes(steps)), load: Math.round(estimateLoad(steps)) };
}

// ---------- Display / export ----------

function fmtDuration(minutes: number): string {
  const total = Math.round(minutes * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m${s}s`;
}

function indoorTarget(s: Step): string {
  if (s.pctHigh !== undefined) return s.ramp ? `ramp ${s.pct}-${s.pctHigh}%` : `${s.pct}-${s.pctHigh}%`;
  return `${s.pct}%`;
}

function outdoorTarget(s: Step): string {
  const zone = powerZone(s.pctHigh ?? s.pct);
  // Heart rate lags on short hard efforts: ride those by feel.
  if (zone >= 5 && s.minutes < 3) return "";
  return `Z${hrZoneForPowerZone(zone)} HR`;
}

function stepLine(s: Step, mode: RideMode): string {
  const parts = ["-"];
  if (s.label) parts.push(s.label.replace(/[-\n]/g, " "));
  parts.push(fmtDuration(s.minutes));
  if (mode === "indoor") {
    parts.push(indoorTarget(s));
    if (s.cadence) parts.push(`${s.cadence}rpm`);
  } else {
    const t = outdoorTarget(s);
    if (t) parts.push(t);
    else parts.push(`(RPE ${rpeForZone(powerZone(s.pctHigh ?? s.pct))})`);
  }
  return parts.join(" ");
}

/** Workout text in intervals.icu's description format. */
export function toIntervalsText(w: ScaledWorkout, mode: RideMode): string {
  const lines: string[] = [];
  if (mode === "outdoor" && w.outdoorGuidance) lines.push(w.outdoorGuidance, "");
  for (const s of w.steps) {
    if (isRepeat(s)) {
      lines.push("", `${s.repeat}x`);
      for (const x of s.steps) lines.push(stepLine(x, mode));
      lines.push("");
    } else {
      lines.push(stepLine(s, mode));
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** .zwo file for manual MyWhoosh import (fallback). */
export function toZwo(w: ScaledWorkout): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const body: string[] = [];
  const emit = (s: Step) => {
    const d = Math.round(s.minutes * 60);
    const cad = s.cadence ? ` Cadence="${s.cadence}"` : "";
    if (s.pctHigh !== undefined && s.ramp) {
      const tag = s.kind === "cooldown" ? "Cooldown" : s.kind === "warmup" ? "Warmup" : "Ramp";
      body.push(`    <${tag} Duration="${d}" PowerLow="${(s.pct / 100).toFixed(2)}" PowerHigh="${(s.pctHigh / 100).toFixed(2)}"${cad}/>`);
    } else {
      const p = s.pctHigh !== undefined ? (s.pct + s.pctHigh) / 200 : s.pct / 100;
      body.push(`    <SteadyState Duration="${d}" Power="${p.toFixed(2)}"${cad}/>`);
    }
  };
  for (const s of w.steps) {
    if (isRepeat(s)) for (let i = 0; i < s.repeat; i++) s.steps.forEach(emit);
    else emit(s);
  }
  return [
    "<workout_file>",
    "  <author>EveryDay</author>",
    `  <name>${esc(w.name)}</name>`,
    `  <description>${esc(w.purpose)}</description>`,
    "  <sportType>bike</sportType>",
    "  <workout>",
    ...body,
    "  </workout>",
    "</workout_file>",
  ].join("\n");
}

export interface DisplayStep {
  minutes: number;
  label: string;
  zone: number;
  indoor: string; // e.g. "245 W" or "149–203 W"
  outdoor: string; // e.g. "Z2 HR 130–145 ud/min" or "RPE 9–10"
  pct: number;
  pctHigh?: number;
  ramp?: boolean;
}

/** Steps with concrete targets for the athlete, for cards and the brief. */
export function displaySteps(w: ScaledWorkout, phys: Physiology): DisplayStep[] {
  return flatten(w.steps).map((s) => {
    const zone = powerZone(s.pctHigh ?? s.pct);
    const indoor =
      s.pctHigh !== undefined
        ? `${watts(s.pct, phys.ftp)}${s.ramp ? "→" : "–"}${watts(s.pctHigh, phys.ftp)} W`
        : `${watts(s.pct, phys.ftp)} W`;
    const hz = hrZoneForPowerZone(zone);
    let outdoor = `RPE ${rpeForZone(zone)}`;
    if (!(zone >= 5 && s.minutes < 3)) {
      outdoor = phys.lthr ? (() => { const r = hrRange(hz, phys.lthr!); return `Z${hz} HR ${r.low}–${r.high} ud/min`; })() : `Z${hz} HR · RPE ${rpeForZone(zone)}`;
    }
    return {
      minutes: s.minutes,
      label: s.label ?? "",
      zone,
      indoor,
      outdoor,
      pct: s.pct,
      ...(s.pctHigh !== undefined ? { pctHigh: s.pctHigh } : {}),
      ...(s.ramp ? { ramp: true } : {}),
    };
  });
}

/** Target text for the brief's focus line ("245 W" indoors, HR outdoors). */
export function mainTargetText(w: ScaledWorkout, phys: Physiology, mode: RideMode): string {
  const s = mainWorkStep(w.steps);
  if (!s) return "";
  const zone = powerZone(s.pctHigh ?? s.pct);
  if (mode === "indoor") {
    const mid = s.pctHigh !== undefined && !s.ramp ? (s.pct + s.pctHigh) / 2 : s.pct;
    return `${watts(mid, phys.ftp)} W`;
  }
  if (zone >= 5 && s.minutes < 3) return `RPE ${rpeForZone(zone)}`;
  const hz = hrZoneForPowerZone(zone);
  if (phys.lthr) {
    const r = hrRange(hz, phys.lthr);
    return `${r.low}–${r.high} ud/min`;
  }
  return `strefie Z${hz} HR`;
}
