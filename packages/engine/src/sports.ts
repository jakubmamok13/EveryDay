// Other sports in the training load (D-047). Two channels, because the
// research points two ways:
//
// - Fatigue is systemic (autonomic system, glycogen, sleep, muscle damage):
//   every session tires the whole body, whatever the sport → full weight.
// - Cycling Fitness is partly sport-specific: central adaptations (heart,
//   VO2max) transfer between running and cycling, peripheral ones (muscles
//   used, pedalling) do not; swimming transfers very little; strength
//   training adds no aerobic fitness (Tanaka 1994; Millet et al. 2002;
//   Menges et al. 2026) → reduced weight.
//
// The weights are *our rule*, set from those studies, and are tuned with real
// data after the Learning Period.

export type SportGroup = "ride" | "run" | "whole_body" | "walk" | "swim" | "strength" | "mobility" | "other";

export interface SportWeights {
  /** Share of the session's Load that builds cycling Fitness. */
  fitness: number;
  /** Share of the session's Load that adds Fatigue. */
  fatigue: number;
  /** Load per hour when intervals.icu has no Load for the session. */
  defaultLoadPerHour: number;
  /** Hard on the legs (eccentric work or heavy lifting) → counts in Readiness. */
  legs: boolean;
  label: string;
}

export const SPORT_WEIGHTS: Record<SportGroup, SportWeights> = {
  ride: { fitness: 1, fatigue: 1, defaultLoadPerHour: 50, legs: false, label: "jazda" },
  run: { fitness: 0.6, fatigue: 1, defaultLoadPerHour: 65, legs: true, label: "bieg" },
  whole_body: { fitness: 0.5, fatigue: 1, defaultLoadPerHour: 55, legs: false, label: "trening wytrzymałościowy" },
  walk: { fitness: 0.3, fatigue: 1, defaultLoadPerHour: 25, legs: false, label: "marsz / wędrówka" },
  swim: { fitness: 0.2, fatigue: 1, defaultLoadPerHour: 50, legs: false, label: "pływanie" },
  strength: { fitness: 0, fatigue: 1, defaultLoadPerHour: 45, legs: true, label: "siłownia" },
  mobility: { fitness: 0, fatigue: 1, defaultLoadPerHour: 15, legs: false, label: "joga / mobilność" },
  other: { fitness: 0.3, fatigue: 1, defaultLoadPerHour: 40, legs: false, label: "inny sport" },
};

/** intervals.icu activity type → group. */
export function sportGroup(type: string): SportGroup {
  const t = type.toLowerCase();
  if (t.includes("ride") || t === "velomobile" || t === "handcycle") return "ride";
  if (t.includes("run")) return "run";
  if (t.includes("swim")) return "swim";
  if (t.includes("walk") || t.includes("hike") || t.includes("snowshoe")) return "walk";
  if (t.includes("weight") || t.includes("crossfit") || t === "workout" || t.includes("hiit")) return "strength";
  if (t.includes("yoga") || t.includes("pilates") || t.includes("stretch")) return "mobility";
  if (/ski|row|elliptical|stair|skate|paddle|kayak|canoe/.test(t)) return "whole_body";
  return "other";
}

/**
 * Load of a non-cycling session. intervals.icu's Load comes first (it uses the
 * sport's own thresholds). Without it we use a per-sport hourly default: the
 * cycling LTHR is not valid for other sports. Heart rate underestimates
 * strength work, so strength never goes below its default (session-RPE
 * studies, Foster et al. 2001).
 */
export function otherSportLoad(group: SportGroup, seconds: number, icuLoad: number | null): number {
  const fallback = (seconds / 3600) * SPORT_WEIGHTS[group].defaultLoadPerHour;
  if (icuLoad === null || icuLoad <= 0) return Math.round(fallback);
  return Math.round(group === "strength" ? Math.max(icuLoad, fallback) : icuLoad);
}
