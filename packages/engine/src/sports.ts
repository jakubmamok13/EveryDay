// Other sports in the training load (D-047, corrected by D-069).
//
// - Cycling Fitness is partly sport-specific: central adaptations (heart,
//   VO2max) transfer between running and cycling, peripheral ones (muscles
//   used, pedalling) do not; swimming transfers very little; strength
//   training adds no aerobic fitness (Tanaka 1994; Millet et al. 2002;
//   Menges et al. 2026) → reduced weight.
// - The same weight goes into Fitness **and** Fatigue (D-069). D-047 put the
//   full Load into Fatigue; with a steady habit (gym 3×/week) that kept Form
//   permanently 35–55% below zero, because a load that never builds Fitness
//   never "pays back" its Fatigue. The short-term fatigue of a leg-heavy
//   session is judged by Readiness instead („Inne sporty (nogi)”), next to
//   HRV, resting HR and sleep, which show systemic fatigue directly.
//
// The weights are *our rule*, set from those studies, and are tuned with real
// data after the Learning Period.

export type SportGroup = "ride" | "run" | "whole_body" | "walk" | "swim" | "strength" | "mobility" | "other";

export interface SportWeights {
  /** Share of the session's Load that counts for cycling (Fitness and Fatigue alike, D-069). */
  weight: number;
  /** Load per hour when intervals.icu has no Load for the session. */
  defaultLoadPerHour: number;
  /** Hard on the legs (eccentric work or heavy lifting) → counts in Readiness. */
  legs: boolean;
  label: string;
}

export const SPORT_WEIGHTS: Record<SportGroup, SportWeights> = {
  ride: { weight: 1, defaultLoadPerHour: 50, legs: false, label: "jazda" },
  run: { weight: 0.6, defaultLoadPerHour: 65, legs: true, label: "bieg" },
  whole_body: { weight: 0.5, defaultLoadPerHour: 55, legs: false, label: "trening wytrzymałościowy" },
  walk: { weight: 0.3, defaultLoadPerHour: 25, legs: false, label: "marsz / wędrówka" },
  swim: { weight: 0.2, defaultLoadPerHour: 50, legs: false, label: "pływanie" },
  strength: { weight: 0, defaultLoadPerHour: 45, legs: true, label: "siłownia" },
  mobility: { weight: 0, defaultLoadPerHour: 15, legs: false, label: "joga / mobilność" },
  other: { weight: 0.3, defaultLoadPerHour: 40, legs: false, label: "inny sport" },
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
