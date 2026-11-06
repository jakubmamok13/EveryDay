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

// ---------- Metoda Norweska (Norwegian Model) ----------
// Pomiary oparte na fizjologii kwasu mlekowego (LT1 i LT2), badaniach dra Stephena Seilera,
// praktyce Mariusa Bakkena i norweskiej federacji sportowej (Olympiatoppen).
// Klucz: 80-85% czasu ściśle poniżej LT1 (< 2.0 mmol/L), kontrolowany próg (sub-threshold,
// 2.0-3.8 mmol/L, optymalnie 2.5-3.5 mmol/L) bez zakwaszenia i wypalenia autonomicznego,
// oraz rygorystycznie racjonowana strefa powyżej LT2 (> 4.0 mmol/L).

/**
 * Trzystrefowy model fizjologiczny Seilera / metody norweskiej.
 * Z1 (< LT1): Niska intensywność / Tlen podstawowy. Cel: 80–85% czasu treningu.
 * Z2 (LT1–LT2): Kontrolowany próg (Sub-threshold do LT2). Cel: 15–18% czasu.
 * Z3 (> LT2): Wysoka intensywność (Severe / VO2max). Cel: 2–5% czasu.
 */
export const NORWEGIAN_3_ZONES = [
  {
    zone: 1,
    name: "Niska intensywność (< LT1)",
    code: "Z1_LOW",
    lowPct: 0,
    highPct: 75,
    lactate: "< 2.0 mmol/L",
    lactateRange: [0.8, 1.9],
    hrPctLthrHigh: 82,
    targetShare: "80–85%",
    description: "Czysty metabolizm tlenowy, rozbudowa mitochondriów, brak zmęczenia autonomicznego.",
  },
  {
    zone: 2,
    name: "Kontrolowany próg (LT1–LT2 / Sub-Threshold)",
    code: "Z2_THRESH",
    lowPct: 76,
    highPct: 100,
    lactate: "2.0–4.0 mmol/L",
    lactateRange: [2.0, 3.8],
    hrPctLthrHigh: 100,
    targetShare: "15–18%",
    description: "Strefa progowa metody norweskiej (optimum 88–95% FTP). Równowaga produkcji i utylizacji mleczanu.",
  },
  {
    zone: 3,
    name: "Wysoka intensywność (> LT2 / Severe)",
    code: "Z3_HIGH",
    lowPct: 101,
    highPct: 1000,
    lactate: "> 4.0 mmol/L",
    lactateRange: [4.0, 15.0],
    hrPctLthrHigh: 120,
    targetShare: "2–5%",
    description: "Powyżej drugiego progu mleczanowego. Gwałtowna kwasica, wysoki koszt regeneracyjny.",
  },
] as const;

/**
 * Pięciostrefowy model Olympiatoppen (Norweski Komitet Olimpijski).
 */
export const NORWEGIAN_5_ZONES = [
  { zone: 1, name: "I1 Restitusjon (Regeneracja)", lowPct: 0, highPct: 60, lactate: "< 1.2 mmol/L", hrPctLthr: 72 },
  { zone: 2, name: "I2 Langkjøring (Baza tlenowa poniżej LT1)", lowPct: 61, highPct: 75, lactate: "1.2–2.0 mmol/L", hrPctLthr: 82 },
  { zone: 3, name: "I3 Terskel (Próg kontrolowany / Sub-threshold)", lowPct: 76, highPct: 97, lactate: "2.0–3.8 mmol/L", hrPctLthr: 98 },
  { zone: 4, name: "I4 O2-opptak (Pułap tlenowy VO2max)", lowPct: 98, highPct: 120, lactate: "4.0–8.0 mmol/L", hrPctLthr: 105 },
  { zone: 5, name: "I5 Anaerob (Maksymalna moc i sprint)", lowPct: 121, highPct: 1000, lactate: "> 8.0 mmol/L", hrPctLthr: 120 },
] as const;

/** Przypisuje procent FTP do strefy w trzystrefowym modelu norweskim (1, 2 lub 3). */
export function norwegian3Zone(pct: number): 1 | 2 | 3 {
  if (pct <= 75) return 1;
  if (pct <= 100) return 2;
  return 3;
}

/** Przypisuje procent FTP do 5-strefowej skali Olympiatoppen (1..5). */
export function norwegian5Zone(pct: number): 1 | 2 | 3 | 4 | 5 {
  for (const z of NORWEGIAN_5_ZONES) {
    if (pct <= z.highPct) return z.zone as 1 | 2 | 3 | 4 | 5;
  }
  return 5;
}

/**
 * Pierwszy próg mleczanowy (LT1 / Próg tlenowy / Aerobic Threshold).
 * Typowo 72–76% FTP (w EveryDay przyjmujemy standardowe 75% FTP).
 */
export function lt1Watts(ftp: number): number {
  return Math.round(ftp * 0.75);
}

/**
 * Drugi próg mleczanowy (LT2 / Próg beztlenowy / Anaerobic Threshold / FTP).
 * Z definicji 100% FTP.
 */
export function lt2Watts(ftp: number): number {
  return Math.round(ftp);
}

/**
 * Zakres podprogowy metody norweskiej (Norwegian Sub-Threshold).
 * 88–95% FTP (optymalnie 92% FTP) — maksymalny bodziec adaptacyjny przy
 * stabilnym stężeniu kwasu mlekowego 2.5–3.5 mmol/L bez zakwaszenia mięśni.
 */
export function norwegianSubThresholdRange(ftp: number): { low: number; high: number; target: number } {
  return {
    low: Math.round(ftp * 0.88),
    high: Math.round(ftp * 0.95),
    target: Math.round(ftp * 0.92),
  };
}

/**
 * Zakres bazy tlenowej poniżej LT1 metody norweskiej.
 * 60–75% FTP — praca czysto tlenowa (mleczan 1.0–1.8 mmol/L).
 */
export function norwegianLt1Range(ftp: number): { low: number; high: number } {
  return {
    low: Math.round(ftp * 0.60),
    high: Math.round(ftp * 0.75),
  };
}

export interface LactateEstimate {
  mmol: number;
  label: string;
  zone: 1 | 2 | 3;
  zoneName: string;
  subThreshold: boolean;
  description: string;
}

/**
 * Estymacja fizjologicznego stężenia kwasu mlekowego (we krwi w mmol/L)
 * na podstawie intensywności wyrażonej jako % FTP według krzywej kinetyki mleczanu.
 */
export function estimateLactate(pct: number): LactateEstimate {
  let mmol: number;
  if (pct <= 55) {
    mmol = 0.9 + (pct / 55) * 0.3; // 0.9 – 1.2 mmol/L
  } else if (pct <= 75) {
    // Odcinek tlenowy do LT1 (~2.0 mmol/L)
    mmol = 1.2 + ((pct - 55) / 20) * 0.8;
  } else if (pct <= 90) {
    // Wejście w strefę podprogową (2.0 – 2.9 mmol/L)
    mmol = 2.0 + ((pct - 75) / 15) * 0.9;
  } else if (pct <= 100) {
    // Górny próg kontrolowany do LT2 (2.9 – 4.0 mmol/L)
    mmol = 2.9 + ((pct - 90) / 10) * 1.1;
  } else if (pct <= 115) {
    // Pułap VO2max (4.0 – 7.2 mmol/L)
    mmol = 4.0 + ((pct - 100) / 15) * 3.2;
  } else {
    // Beztlenowe / Sprint (> 7.2 mmol/L)
    mmol = 7.2 + Math.min(8.0, ((pct - 115) / 35) * 5.0);
  }

  const rounded = Math.round(mmol * 10) / 10;
  const isSub = pct >= 88 && pct <= 96;

  if (rounded < 2.0) {
    return {
      mmol: rounded,
      label: `< 2.0 mmol/L (Czysty tlen / < LT1)`,
      zone: 1,
      zoneName: "Z1 Niska intensywność (< LT1)",
      subThreshold: false,
      description: "Praca w strefie czysto tlenowej. Niski koszt nerwowy i brak zakwaszenia.",
    };
  } else if (rounded <= 4.0) {
    return {
      mmol: rounded,
      label: `${rounded} mmol/L (${isSub ? "Optymalny Sub-LT2" : "Kontrolowany próg"})`,
      zone: 2,
      zoneName: "Z2 Kontrolowany próg (LT1–LT2)",
      subThreshold: isSub,
      description: isSub
        ? "Złoty środek metody norweskiej: maksymalna stymulacja progu przy stabilnym mleczanie."
        : "Strefa progowa w równowadze produkcji i utylizacji mleczanu.",
    };
  } else {
    return {
      mmol: rounded,
      label: `${rounded} mmol/L (Powyżej LT2 / Zakwaszenie)`,
      zone: 3,
      zoneName: "Z3 Wysoka intensywność (> LT2)",
      subThreshold: false,
      description: "Praca ponad progiem beztlenowym z akumulacją jonów wodorowych. Wymaga długiej regeneracji.",
    };
  }
}

/** Tabela 3 stref norweskich w watach i tętnie dla danego sportowca. */
export function norwegian3ZoneTable(ftp: number, lthr?: number | null) {
  return NORWEGIAN_3_ZONES.map((z) => ({
    zone: z.zone,
    name: z.name,
    code: z.code,
    lowWatts: z.zone === 1 ? 0 : watts(z.lowPct, ftp),
    highWatts: z.zone === 3 ? null : watts(z.highPct, ftp),
    lactate: z.lactate,
    targetShare: z.targetShare,
    hrHigh: lthr ? Math.round((lthr * z.hrPctLthrHigh) / 100) : null,
    description: z.description,
  }));
}

/** Tabela 5 stref Olympiatoppen w watach i tętnie dla danego sportowca. */
export function norwegian5ZoneTable(ftp: number, lthr?: number | null) {
  return NORWEGIAN_5_ZONES.map((z) => ({
    zone: z.zone,
    name: z.name,
    lowWatts: z.zone === 1 ? 0 : watts(z.lowPct, ftp),
    highWatts: z.zone === 5 ? null : watts(z.highPct, ftp),
    lactate: z.lactate,
    hrHigh: lthr ? Math.round((lthr * z.hrPctLthr) / 100) : null,
  }));
}

export interface TidAnalysis {
  z1Minutes: number;
  z2Minutes: number;
  z3Minutes: number;
  totalMinutes: number;
  z1Pct: number;
  z2Pct: number;
  z3Pct: number;
  isNorwegianCompliant: boolean;
  diagnosis: string;
}

/**
 * Analizuje rozkład intensywności treningowej (Training Intensity Distribution - TID)
 * według 3-strefowego modelu Seilera / metody norweskiej.
 * Złoty standard: >= 75-80% czasu w Z1 (< LT1), 15-20% w Z2 (próg), <= 5-8% w Z3 (> LT2).
 */
export function analyzeTid(steps: { minutes: number; pct: number }[]): TidAnalysis {
  let z1Minutes = 0;
  let z2Minutes = 0;
  let z3Minutes = 0;

  for (const s of steps) {
    const z = norwegian3Zone(s.pct);
    if (z === 1) z1Minutes += s.minutes;
    else if (z === 2) z2Minutes += s.minutes;
    else z3Minutes += s.minutes;
  }

  const totalMinutes = Math.max(1, z1Minutes + z2Minutes + z3Minutes);
  const z1Pct = Math.round((z1Minutes / totalMinutes) * 100);
  const z2Pct = Math.round((z2Minutes / totalMinutes) * 100);
  const z3Pct = Math.round((z3Minutes / totalMinutes) * 100);

  // Zgodność: co najmniej 75% w Z1 i nie więcej niż 8% w Z3 (ochrona przed wypaleniem)
  const isNorwegianCompliant = z1Pct >= 75 && z3Pct <= 8;

  let diagnosis: string;
  if (isNorwegianCompliant) {
    diagnosis = `Wzorowy rozkład norweski (${z1Pct}% Z1 / ${z2Pct}% Z2 / ${z3Pct}% Z3): fundament tlenowy z kontrolowaną dawką progu.`;
  } else if (z1Pct < 75 && z2Pct > 25) {
    diagnosis = `Rozkład progowy / piramidalny (${z1Pct}% Z1 / ${z2Pct}% Z2 / ${z3Pct}% Z3). Metoda norweska zaleca zwiększenie spokojnej objętości w Z1 (< 75% FTP).`;
  } else if (z3Pct > 8) {
    diagnosis = `Zbyt dużo czasu powyżej LT2 (${z3Pct}% w Z3). Ryzyko akumulacji zmęczenia układu współczulnego. Zredukuj intensywność do strefy podprogowej.`;
  } else {
    diagnosis = `Rozkład: ${z1Pct}% Z1 / ${z2Pct}% Z2 / ${z3Pct}% Z3.`;
  }

  return {
    z1Minutes: Math.round(z1Minutes * 10) / 10,
    z2Minutes: Math.round(z2Minutes * 10) / 10,
    z3Minutes: Math.round(z3Minutes * 10) / 10,
    totalMinutes: Math.round(totalMinutes * 10) / 10,
    z1Pct,
    z2Pct,
    z3Pct,
    isNorwegianCompliant,
    diagnosis,
  };
}

