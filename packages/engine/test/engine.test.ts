import { describe, expect, it } from "vitest";
import { LIBRARY } from "@everyday/library";
import { addDays, type PlannedDay, type Readiness } from "@everyday/shared";
import {
  adapt,
  assembleBrief,
  assignRoles,
  buildBriefFacts,
  checkEnvelope,
  compliance,
  computeReadiness,
  displaySteps,
  estimateLoad,
  findDuplicates,
  findWorkout,
  fitnessAfterWeek,
  ftpSuggestion,
  fueling,
  moveMissedKey,
  performanceSeries,
  planWeeks,
  powerLoad,
  progressLadder,
  proposeLongRideDay,
  scaleWorkout,
  shortenAndCap,
  toIntervalsText,
  toZwo,
  weeklyLoadCap,
  explainSignals,
  otherSportLoad,
  rateOtherSport,
  readinessRule,
  sportGroup,
  SPORT_WEIGHTS,
} from "../src";
import { SAMPLE_AVAILABILITY, SAMPLE_GOALS, SAMPLE_PHYS } from "./fixtures";

const MONDAY = "2026-10-05";

function plan(weeks: number, fitness = 45) {
  return planWeeks({
    today: MONDAY,
    planStart: MONDAY,
    firstWeek: MONDAY,
    weeks,
    goals: SAMPLE_GOALS,
    availability: SAMPLE_AVAILABILITY,
    fitness,
    ladder: {},
    longestRecentMinutes: 150,
    library: LIBRARY,
    testInRecoveryWeek: true,
  });
}

describe("library", () => {
  it("has about 40 workouts with unique slugs and fitting 60-min quality sessions", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(38);
    expect(new Set(LIBRARY.map((w) => w.slug)).size).toBe(LIBRARY.length);
    for (const w of LIBRARY.filter((x) => ["sweet_spot", "threshold", "vo2max"].includes(x.category))) {
      expect(scaleWorkout(w).minutes, w.slug).toBeLessThanOrEqual(62);
    }
  });
});

describe("load", () => {
  it("one hour at FTP is 100", () => {
    expect(powerLoad(3600, 270, 270)).toBeCloseTo(100);
  });
  it("planned load of a steady hour at 70% is ~49", () => {
    expect(estimateLoad([{ kind: "steady", minutes: 60, pct: 70 }])).toBeCloseTo(49);
  });
  it("weekly cap produces exactly the ramp", () => {
    const cap = weeklyLoadCap(50, 5);
    expect(fitnessAfterWeek(50, cap)).toBeCloseTo(55, 5);
  });
  it("morning form uses yesterday's values", () => {
    const loads = new Map([["2026-10-01", 100]]);
    const s = performanceSeries(loads, "2026-10-01", "2026-10-02", { fitness: 50, fatigue: 50 });
    expect(s[0]!.form).toBe(0);
    expect(s[1]!.form).toBeLessThan(0);
  });
});

describe("workouts", () => {
  it("fills endurance rides to the target length and names them", () => {
    const w = scaleWorkout(findWorkout(LIBRARY, "endurance-z2"), { targetMinutes: 150 });
    expect(w.minutes).toBe(150);
    expect(w.name).toBe("Wytrzymałość 2 h 30 min");
  });
  it("names interval sessions from the repeat count", () => {
    expect(scaleWorkout(findWorkout(LIBRARY, "ss-3x12")).name).toBe("Sweet Spot 3×12 min");
  });
  it("exports intervals.icu text indoors (power) and outdoors (HR)", () => {
    const w = scaleWorkout(findWorkout(LIBRARY, "ss-3x12"));
    const indoor = toIntervalsText(w, "indoor");
    expect(indoor).toContain("3x");
    expect(indoor).toContain("- Sweet Spot 12m 88-92% 90rpm");
    const outdoor = toIntervalsText(w, "outdoor");
    expect(outdoor).toContain("Z4 HR");
    expect(outdoor).not.toContain("%");
  });
  it("short hard steps outdoors are ridden by feel", () => {
    const w = scaleWorkout(findWorkout(LIBRARY, "vo2-30-30"));
    expect(toIntervalsText(w, "outdoor")).toContain("(RPE");
  });
  it("exports a .zwo file", () => {
    const x = toZwo(scaleWorkout(findWorkout(LIBRARY, "thr-3x10")));
    expect(x).toContain("<workout_file>");
    expect(x.match(/SteadyState/g)!.length).toBeGreaterThanOrEqual(6);
  });
  it("shows watts and HR zones for the athlete", () => {
    const steps = displaySteps(scaleWorkout(findWorkout(LIBRARY, "ss-3x12")), SAMPLE_PHYS);
    const work = steps.find((s) => s.label === "Sweet Spot")!;
    expect(work.indoor).toBe("220–230 W");
    expect(work.outdoor).toMatch(/^Z4 HR \d+–\d+ ud\/min$/);
  });
});

describe("planner — sample week", () => {
  it("assigns Tue/Thu quality, Sat long, Sun endurance", () => {
    const roles = assignRoles(SAMPLE_AVAILABILITY, 2);
    expect(roles.get(2)).toBe("quality");
    expect(roles.get(4)).toBe("quality");
    expect(roles.get(6)).toBe("long");
    expect(roles.get(7)).toBe("endurance");
  });

  it("first week: sweet spot block, everything fits the day", () => {
    const [w] = plan(1);
    expect(w!.focus).toBe("sweet_spot");
    expect(w!.days.map((d) => d.role)).toEqual(["quality", "quality", "long", "endurance"]);
    for (const d of w!.days) {
      const max = SAMPLE_AVAILABILITY.find((a) => a.weekday === new Date(d.date + "T00:00:00Z").getUTCDay() || (a.weekday === 7 && new Date(d.date + "T00:00:00Z").getUTCDay() === 0))!.maxMinutes;
      expect(d.workout.minutes, d.date).toBeLessThanOrEqual(max + 2);
    }
    expect(w!.days[0]!.workout.category).toBe("sweet_spot");
    expect(w!.days[2]!.workout.category).toBe("long_ride");
  });

  it("12-week simulation: recovery every 4th week, ramp cap, no hard days in a row", () => {
    const weeks = plan(12, 40);
    expect(weeks.map((w) => w.kind)).toEqual([
      "load", "load", "load", "recovery",
      "load", "load", "load", "recovery",
      "load", "load", "load", "recovery",
    ]);
    expect(weeks.map((w) => w.focus).filter((_, i) => i % 4 === 0)).toEqual(["sweet_spot", "threshold", "vo2max"]);
    let fitness = 40;
    for (const w of weeks) {
      const total = w.days.reduce((s, d) => s + d.workout.load, 0);
      const next = fitnessAfterWeek(fitness, total);
      expect(next - fitness, w.weekStart).toBeLessThanOrEqual(5.01);
      fitness = next;
    }
    const all = weeks.flatMap((w) => w.days);
    const hard = all.filter((d) => d.workout.intensity === "hard").map((d) => d.date);
    for (const d of hard) expect(hard.includes(addDays(d, 1)), d).toBe(false);
    const recoveryThus = weeks.filter((w) => w.kind === "recovery").map((w) => w.days.find((d) => d.date === addDays(w.weekStart, 3)));
    for (const d of recoveryThus) expect(d?.workout.slug).toBe("ramp-test");
  });

  it("puts openers before an event and nothing on the event day", () => {
    const weeks = planWeeks({
      today: MONDAY, planStart: MONDAY, firstWeek: MONDAY, weeks: 1,
      goals: [{ role: "primary", type: "event", eventDate: "2026-10-11", eventName: "Gran Fondo" }],
      availability: SAMPLE_AVAILABILITY, fitness: 50, ladder: {}, longestRecentMinutes: 180, library: LIBRARY,
    });
    const days = weeks[0]!.days;
    expect(days.find((d) => d.date === "2026-10-10")!.workout.slug).toBe("openers");
    expect(days.find((d) => d.date === "2026-10-11")).toBeUndefined();
    expect(weeks[0]!.kind).toBe("taper");
  });

  it("includes a confirmed Long Ride Day and eases the next day", () => {
    const weeks = planWeeks({
      today: MONDAY, planStart: MONDAY, firstWeek: MONDAY, weeks: 1, goals: SAMPLE_GOALS,
      availability: SAMPLE_AVAILABILITY, fitness: 60, ladder: {}, longestRecentMinutes: 240, library: LIBRARY,
      confirmedLongRides: [{ date: "2026-10-10", minutes: 330 }],
    });
    const sat = weeks[0]!.days.find((d) => d.date === "2026-10-10")!;
    expect(sat.role).toBe("long_ride_day");
    expect(sat.workout.minutes).toBe(330);
    expect(weeks[0]!.days.find((d) => d.date === "2026-10-11")!.workout.minutes).toBe(60);
  });
});

function readiness(over: Partial<Readiness> = {}): Readiness {
  return { date: MONDAY, score: 100, state: "green", effective: "green", inputs: [], overrides: [], mainReason: "all_ok", ...over };
}

describe("readiness", () => {
  const wellness = Array.from({ length: 70 }, (_, i) => ({
    date: addDays(MONDAY, i - 69),
    hrv: 60 + ((i * 7) % 5),
    restingHr: 50,
    sleepSeconds: 7.5 * 3600,
    bodyBatteryMax: 80,
  }));

  it("is green when everything is normal", () => {
    const r = computeReadiness({ date: MONDAY, wellness, formPct: -0.1, checkIn: { date: MONDAY, sleepQuality: 4, legs: 4, motivation: 4, sick: false, pain: false, rideMode: "indoor" } });
    expect(r.state).toBe("green");
    expect(r.score).toBe(100);
  });

  it("goes red when sick", () => {
    const r = computeReadiness({ date: MONDAY, wellness, checkIn: { date: MONDAY, sleepQuality: 4, legs: 4, motivation: 4, sick: true, pain: false, rideMode: "indoor" } });
    expect(r.effective).toBe("red");
    expect(r.mainReason).toBe("sick");
  });

  it("totally exhausted means a red day", () => {
    const r = computeReadiness({ date: MONDAY, wellness, checkIn: { date: MONDAY, sleepQuality: 2, legs: 1, motivation: 1, sick: false, pain: false, rideMode: "indoor", exhausted: true } });
    expect(r.effective).toBe("red");
    expect(r.mainReason).toBe("exhausted");
  });

  it("flags low HRV and high resting HR", () => {
    const bad = wellness.map((w) => (w.date === MONDAY ? { ...w, hrv: 40, restingHr: 59 } : w));
    const r = computeReadiness({ date: MONDAY, wellness: bad });
    expect(r.inputs.find((i) => i.key === "hrv")!.rating).toBe("caution");
    expect(r.inputs.find((i) => i.key === "rhr")!.rating).toBe("bad");
    expect(r.effective).toBe("yellow");
  });

  it("treats two low check-in answers as a strong signal", () => {
    const r = computeReadiness({ date: MONDAY, wellness, checkIn: { date: MONDAY, sleepQuality: 2, legs: 2, motivation: 4, sick: false, pain: false, rideMode: "indoor" } });
    expect(r.effective).toBe("yellow");
    expect(r.inputs.find((i) => i.key === "check_in")!.rating).toBe("bad");
  });

  it("shows learning during the Learning Period", () => {
    const r = computeReadiness({ date: MONDAY, wellness, learningUntil: addDays(MONDAY, 3) });
    expect(r.state).toBe("learning");
    expect(r.inputs.find((i) => i.key === "hrv")!.detail).toBe("learning");
  });
});

describe("adaptation and envelope", () => {
  const [week] = plan(1, 50);
  const monday = week!.days[0]!; // first training day (Tuesday)
  const sunday = week!.days[3]!;

  it("keeps the plan on a green day", () => {
    expect(adapt({ date: MONDAY, readiness: readiness(), planned: monday, recentlySick: false, laterThisWeek: [], library: LIBRARY }).action).toBe("keep");
  });
  it("reduces a Key Workout on a yellow day", () => {
    const res = adapt({ date: MONDAY, readiness: readiness({ effective: "yellow", state: "yellow" }), planned: monday, recentlySick: false, laterThisWeek: [], library: LIBRARY });
    expect(res.action).toBe("reduce");
    expect(res.workout!.load).toBeLessThan(monday.workout.load);
  });
  it("turns a red Key Workout into recovery and flags it missed", () => {
    const res = adapt({ date: MONDAY, readiness: readiness({ effective: "red", state: "red", score: 50 }), planned: monday, recentlySick: false, laterThisWeek: [], library: LIBRARY });
    expect(res.action).toBe("recovery");
    expect(res.keyMissed).toBe(true);
    expect(res.workout!.category).toBe("recovery");
  });
  it("rests when sick", () => {
    const res = adapt({ date: MONDAY, readiness: readiness({ overrides: ["sick"], effective: "red" }), planned: monday, recentlySick: false, laterThisWeek: [], library: LIBRARY });
    expect(res.workout).toBeNull();
  });

  const avail = [2, 4, 6, 7];
  const ctx = (after: PlannedDay[]) => ({ before: monday, availableWeekdays: avail, weekAfter: after, weekPlannedLoad: week!.targetLoad, overrides: [] as Readiness["overrides"] });

  it("allows a shorter, easier version", () => {
    const easier = shortenAndCap(monday.workout, 0.8);
    const after = week!.days.map((d) => (d.date === monday.date ? { ...d, workout: easier } : d));
    expect(checkEnvelope({ date: monday.date, fromDate: monday.date, workout: easier }, ctx(after)).ok).toBe(true);
  });
  it("rejects a harder workout", () => {
    const harder = scaleWorkout(findWorkout(LIBRARY, "vo2-5x3"));
    const after = week!.days.map((d) => (d.date === monday.date ? { ...d, workout: harder } : d));
    const res = checkEnvelope({ date: monday.date, fromDate: monday.date, workout: harder }, ctx(after));
    expect(res.ok).toBe(false);
    expect(res.reasons).toContain("category_change");
  });
  it("rejects a move of more than one day", () => {
    const res = checkEnvelope({ date: addDays(MONDAY, 2), fromDate: MONDAY, workout: monday.workout }, ctx(week!.days));
    expect(res.reasons).toContain("move_too_far");
  });

  it("drops a missed Tuesday Key Workout when no free day fits", () => {
    const nextTuesday: PlannedDay = { ...monday, date: addDays(monday.date, 7) };
    const to = moveMissedKey({
      missed: monday,
      laterThisWeek: week!.days.slice(1),
      availableWeekdays: [2, 4, 6],
      neighbours: [...week!.days, nextTuesday],
      formPct: -0.1,
    });
    expect(to).toBeNull();
  });
  it("moves a missed Tuesday Key Workout to a free day when it fits", () => {
    const to = moveMissedKey({ missed: monday, laterThisWeek: [sunday], availableWeekdays: [2, 4, 7], neighbours: [monday, sunday], formPct: 0 });
    expect(to).toBe(addDays(MONDAY, 3));
  });
});

describe("progress", () => {
  it("climbs after two too-easy rides and drops after a too-hard one", () => {
    const up = progressLadder({ sweet_spot: 2 }, [
      { date: "2026-10-05", category: "sweet_spot", compliancePct: 98, feel: "too_easy" },
      { date: "2026-10-07", category: "sweet_spot", compliancePct: 95, feel: "too_easy" },
    ]);
    expect(up.ladder.sweet_spot).toBe(3);
    const down = progressLadder({ threshold: 3 }, [{ date: "2026-10-07", category: "threshold", compliancePct: 70, feel: "just_right" }]);
    expect(down.ladder.threshold).toBe(2);
  });
  it("computes compliance", () => {
    expect(compliance({ minutes: 60, load: 70 }, { minutes: 60, load: 70 })).toBe(100);
    expect(compliance({ minutes: 60, load: 70 }, { minutes: 30, load: 35 })).toBe(50);
  });
  it("suggests FTP after two consistent estimates", () => {
    expect(ftpSuggestion(250, [261, 263])).toBe(262);
    expect(ftpSuggestion(250, [261, 252])).toBeNull();
  });
  it("proposes a Long Ride Day a week or more ahead on Saturday", () => {
    const p = proposeLongRideDay({ today: MONDAY, lastLongRideDay: null, everyWeeks: 5, longestRideMinutes: 240, targetMinutes: 420, availability: SAMPLE_AVAILABILITY });
    expect(p).toEqual({ date: "2026-10-17", minutes: 300 });
  });
  it("fuels rides over 90 min", () => {
    expect(fueling(60)).toBeNull();
    expect(fueling(120)!.carbsPerHour).toBe(60);
    expect(fueling(300, 2)!.carbsPerHour).toBe(80);
  });
});

describe("duplicates", () => {
  const t = Date.parse("2026-10-05T17:00:00Z");
  it("keeps MyWhoosh indoors and BOLT outdoors", () => {
    const d = findDuplicates([
      { id: "mw", startMs: t, durationSec: 3600, source: "mywhoosh", indoor: true, hasPower: true },
      { id: "fx", startMs: t + 30_000, durationSec: 3580, source: "fenix", indoor: true, hasPower: false },
      { id: "bolt", startMs: t + 86_400_000, durationSec: 7200, source: "bolt", indoor: false, hasPower: false },
      { id: "fx2", startMs: t + 86_400_000 - 60_000, durationSec: 7300, source: "fenix", indoor: false, hasPower: false },
    ]);
    expect(d.get("fx")).toBe("mw");
    expect(d.get("fx2")).toBe("bolt");
    expect(d.has("mw")).toBe(false);
  });
});

describe("brief", () => {
  it("builds the fixed Polish format with engine numbers", () => {
    const [week] = plan(1, 50);
    const today = week!.days[0]!;
    const facts = buildBriefFacts({
      date: today.date,
      readiness: readiness({ inputs: [{ key: "hrv", rating: "ok" }, { key: "check_in", rating: "ok" }] }),
      withCheckIn: true,
      today,
      rideMode: "indoor",
      physiology: SAMPLE_PHYS,
      upcoming: week!.days,
    });
    const { text } = assembleBrief(facts);
    expect(text).toContain("Dziś: Sweet Spot");
    expect(text).toContain("W domu (MyWhoosh)");
    expect(text).toContain("Gotowość: 🟢 dobra — HRV w normie, nogi świeże");
    expect(text).toMatch(/Skup się: Równe 2[23]\d W w blokach/);
    expect(text).toMatch(/Jutro: Wolne\. Czwartek: Sweet Spot \d×\d+ min\./);
    expect(facts.numbers).toContain(String(today.workout.minutes));
    expect(facts.numbers).toContain(facts.workout!.target.replace(" W", ""));
  });
  it("explains an adaptation", () => {
    const [week] = plan(1, 50);
    const today = week!.days[0]!;
    const r = readiness({ effective: "yellow", state: "yellow", mainReason: "sleep:caution", inputs: [{ key: "sleep", rating: "caution", value: 5.5 }] });
    const res = adapt({ date: MONDAY, readiness: r, planned: today, recentlySick: false, laterThisWeek: [], library: LIBRARY });
    const facts = buildBriefFacts({
      date: MONDAY, readiness: r, withCheckIn: false, today: { ...today, workout: res.workout! }, before: today,
      adaptation: res, rideMode: "indoor", physiology: SAMPLE_PHYS, upcoming: week!.days,
    });
    const { text } = assembleBrief(facts);
    expect(text).toContain("Zmiana:");
    expect(text).toContain("sen 5,5 h (bez check-inu");
  });
});

describe("other sports (D-047)", () => {
  it("groups intervals.icu activity types", () => {
    expect(sportGroup("VirtualRide")).toBe("ride");
    expect(sportGroup("GravelRide")).toBe("ride");
    expect(sportGroup("TrailRun")).toBe("run");
    expect(sportGroup("WeightTraining")).toBe("strength");
    expect(sportGroup("Swim")).toBe("swim");
    expect(sportGroup("Hike")).toBe("walk");
    expect(sportGroup("NordicSki")).toBe("whole_body");
    expect(sportGroup("Yoga")).toBe("mobility");
    expect(sportGroup("Tennis")).toBe("other");
  });
  it("takes intervals.icu Load first, never lets strength fall below its default", () => {
    expect(otherSportLoad("run", 3600, 70)).toBe(70);
    expect(otherSportLoad("run", 1800, null)).toBe(33);
    expect(otherSportLoad("strength", 3600, 15)).toBe(45);
    expect(otherSportLoad("swim", 3600, 0)).toBe(50);
  });
  it("adds full Load to Fatigue but only part of it to Fitness", () => {
    const fit = new Map([["2026-10-01", 60 * SPORT_WEIGHTS.run.fitness]]);
    const fat = new Map([["2026-10-01", 60]]);
    const two = performanceSeries(fit, "2026-10-01", "2026-10-02", undefined, fat);
    const ride = performanceSeries(fat, "2026-10-01", "2026-10-02");
    expect(two[0]!.fatigue).toBeCloseTo(ride[0]!.fatigue);
    expect(two[0]!.fitness).toBeLessThan(ride[0]!.fitness);
  });
  it("rates leg-heavy sessions of the last two days", () => {
    expect(rateOtherSport(undefined, MONDAY)).toBeNull();
    expect(rateOtherSport([], MONDAY)).toMatchObject({ rating: "ok", detail: "none" });
    expect(rateOtherSport([{ date: addDays(MONDAY, -1), group: "run", load: 45 }], MONDAY)).toMatchObject({ rating: "caution", value: 45, detail: "run:1" });
    expect(rateOtherSport([{ date: addDays(MONDAY, -1), group: "strength", load: 110 }], MONDAY)!.rating).toBe("bad");
    expect(rateOtherSport([{ date: addDays(MONDAY, -2), group: "run", load: 50 }], MONDAY)!.rating).toBe("ok");
    expect(rateOtherSport([{ date: addDays(MONDAY, -1), group: "swim", load: 90 }], MONDAY)).toMatchObject({ rating: "ok", detail: "none" });
  });
  it("explains every signal and the colour rule in Polish", () => {
    const r = computeReadiness({ date: MONDAY, wellness: [], recentOther: [{ date: addDays(MONDAY, -1), group: "run", load: 45 }] });
    const rows = explainSignals(r);
    expect(rows.find((x) => x.key === "other_sport")).toMatchObject({ value: "bieg wczoraj, obc. 45", ratingWord: "uważaj" });
    expect(readinessRule(r)).toContain("0× „źle”, 1× „uważaj” → zielony dzień");
  });
});
