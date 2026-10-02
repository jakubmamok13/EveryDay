import type { AvailabilityDay, Goal, Physiology } from "@everyday/shared";

// A generic sample athlete for tests (no real person's data).

export const SAMPLE_AVAILABILITY: AvailabilityDay[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  available: [2, 4, 6, 7].includes(weekday),
  maxMinutes: weekday === 2 || weekday === 4 ? 60 : weekday === 6 ? 180 : weekday === 7 ? 120 : 0,
  defaultRideMode: weekday >= 6 ? "outdoor" : "indoor",
  notifyTime: "07:00",
}));

export const SAMPLE_GOALS: Goal[] = [
  { role: "primary", type: "raise_ftp" },
  { role: "secondary", type: "endurance", targetDistanceKm: 150, targetMinutes: 330 },
];

export const SAMPLE_PHYS: Physiology = { ftp: 250, lthr: 162, maxHr: 184, weightKg: 75 };
