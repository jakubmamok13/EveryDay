// Coggan power zones (% FTP) and LTHR-based heart-rate zones (D-010).

export const POWER_ZONES = [
  { zone: 1, name: "Regeneracja", low: 0, high: 55 },
  { zone: 2, name: "Wytrzymałość", low: 56, high: 75 },
  { zone: 3, name: "Tempo", low: 76, high: 90 },
  { zone: 4, name: "Próg", low: 91, high: 105 },
  { zone: 5, name: "VO2max", low: 106, high: 120 },
  { zone: 6, name: "Beztlenowa", low: 121, high: 150 },
  { zone: 7, name: "Sprint", low: 151, high: 1000 },
] as const;

/** Coggan HR zones as % of LTHR. */
export const HR_ZONES = [
  { zone: 1, low: 0, high: 68 },
  { zone: 2, low: 69, high: 83 },
  { zone: 3, low: 84, high: 94 },
  { zone: 4, low: 95, high: 105 },
  { zone: 5, low: 106, high: 120 },
] as const;

export function powerZone(pct: number): number {
  for (const z of POWER_ZONES) if (pct <= z.high) return z.zone;
  return 7;
}

export function hrZoneForPowerZone(zone: number): number {
  return Math.min(zone, 5);
}

export function hrRange(hrZone: number, lthr: number): { low: number; high: number } {
  const z = HR_ZONES[Math.min(Math.max(hrZone, 1), 5) - 1]!;
  const low = z.zone === 1 ? Math.round(lthr * 0.55) : Math.round((lthr * z.low) / 100);
  const high = Math.round((lthr * (z.zone === 5 ? 110 : z.high)) / 100);
  return { low, high };
}

/** Perceived exertion (1–10) for a power zone. */
export function rpeForZone(zone: number): string {
  return ["", "1–2", "3–4", "5–6", "7", "8–9", "9–10", "10"][zone] ?? "5";
}

export function watts(pct: number, ftp: number): number {
  return Math.round((pct * ftp) / 100);
}

export function powerZoneTable(ftp: number) {
  return POWER_ZONES.map((z) => ({
    zone: z.zone,
    name: z.name,
    low: z.zone === 1 ? 0 : watts(z.low, ftp),
    high: z.zone === 7 ? null : watts(z.high, ftp),
  }));
}
