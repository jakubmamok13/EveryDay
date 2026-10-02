import type { Readiness, ReadinessState } from "@everyday/shared";

// Polish texts produced by the engine (D-013). Clear and short (D-021).

export const READINESS_WORD: Record<ReadinessState, string> = {
  green: "dobra",
  yellow: "uważaj",
  red: "regeneracja",
  learning: "uczę się",
};

export const READINESS_EMOJI: Record<ReadinessState, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
  learning: "⚪",
};

export const ENVELOPE_REASON: Record<string, string> = {
  move_too_far: "przesunięcie o więcej niż 1 dzień",
  category_change: "zmiana na inny, mocniejszy typ treningu",
  duration_change: "zmiana długości o więcej niż 20%",
  harder: "trening byłby mocniejszy niż w planie",
  unavailable_day: "ten dzień nie jest dostępny w Twoim tygodniu",
  week_load: "tydzień byłby cięższy niż plan",
  hard_days_in_a_row: "wyszłyby dwa mocne dni z rzędu",
  sick: "jesteś chory — dziś tylko odpoczynek",
  pain: "zgłoszony ból — tylko spokojna jazda",
  no_planned_workout: "na ten dzień nie ma treningu do zmiany",
};

export const CHANGE_REASON: Record<string, string> = {
  sick: "choroba",
  exhausted: "totalne wyczerpanie",
  return_after_illness: "powrót po chorobie",
  pain: "zgłoszony ból",
  yellow: "gotowość na żółto",
  yellow_twice: "drugi żółty dzień z rzędu",
  red: "organizm potrzebuje odpoczynku",
  green: "",
  manual: "Twoja zmiana",
  chat: "prośba z czatu",
  missed: "przeniesiony trening kluczowy",
};

function inputText(r: Readiness, key: string): string | null {
  const i = r.inputs.find((x) => x.key === key);
  if (!i) return null;
  switch (key) {
    case "hrv":
      return i.rating === "bad" ? "HRV od kilku dni poniżej normy" : i.rating === "caution" ? "HRV poniżej Twojej normy" : "HRV w normie";
    case "rhr": {
      const diff = i.value != null && i.baseline != null ? Math.round(i.value - i.baseline) : null;
      return i.rating === "ok" ? "tętno spoczynkowe w normie" : `tętno spoczynkowe wyższe${diff ? ` o ${diff} ud/min` : ""}`;
    }
    case "sleep":
      return i.rating === "ok" ? "dobry sen" : `sen ${String(i.value).replace(".", ",")} h`;
    case "body_battery":
      return `Body Battery ${i.value}`;
    case "garmin_readiness":
      return `Garmin: gotowość ${i.value}`;
    case "form":
      return i.rating === "ok" ? "zmęczenie pod kontrolą" : `duże zmęczenie treningowe (Forma ${i.value}%)`;
    case "check_in": {
      if (i.rating === "ok") return "nogi świeże";
      const d = i.detail ?? "";
      const parts = [
        d.includes("legs") ? "ciężkie nogi" : null,
        d.includes("sleepQuality") ? "słaby sen" : null,
        d.includes("motivation") ? "niska motywacja" : null,
      ].filter(Boolean);
      return parts.length ? parts.join(" i ") : "słabsze samopoczucie";
    }
  }
  return null;
}

/** One short reason for the Readiness line. */
export function readinessReason(r: Readiness, withCheckIn: boolean): string {
  let text: string;
  if (r.mainReason === "sick") text = "zgłoszona choroba";
  else if (r.mainReason === "exhausted") text = "totalne wyczerpanie — dziś odpoczynek";
  else if (r.mainReason === "pain") text = "zgłoszony ból — bez mocnych akcentów";
  else if (r.mainReason === "no_data") text = "brak danych z zegarka";
  else if (r.mainReason === "all_ok") {
    const parts = ["hrv", "check_in", "sleep", "form"]
      .filter((k) => r.inputs.find((i) => i.key === k)?.rating === "ok")
      .map((k) => inputText(r, k)!)
      .slice(0, 2);
    text = parts.length ? parts.join(", ") : "sygnały w normie";
  } else {
    text = inputText(r, r.mainReason.split(":")[0]!) ?? "sygnały w normie";
    if (r.effective === "green") text += ", reszta w normie";
  }
  return withCheckIn ? text : `${text} (bez check-inu — tylko dane z zegarka)`;
}
