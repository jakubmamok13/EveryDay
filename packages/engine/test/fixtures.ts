import type { AvailabilityDay, Goal, Physiology } from "@everyday/shared";

export const AUTHOR_AVAILABILITY: AvailabilityDay[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  available: [1, 3, 6, 7].includes(weekday),
  maxMinutes: weekday === 1 || weekday === 3 ? 60 : weekday >= 6 ? 240 : 0,
  defaultRideMode: weekday >= 6 ? "outdoor" : "indoor",
  notifyTime: "07:00",
}));

export const AUTHOR_GOALS: Goal[] = [
  { role: "primary", type: "raise_ftp" },
  { role: "secondary", type: "endurance", targetDistanceKm: 200, targetMinutes: 420 },
];

export const AUTHOR_PHYS: Physiology = { ftp: 270, lthr: 165, maxHr: 185, weightKg: 86 };
