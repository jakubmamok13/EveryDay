import type { Readiness, ReadinessInput, ReadinessState } from "@everyday/shared";
import { SPORT_WEIGHTS, type SportGroup } from "./sports";

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
    case "other_sport": {
      if (i.detail === "none" || !i.detail) return "bez mocnych treningów nóg w innych sportach";
      const [group, days] = i.detail.split(":");
      const label = SPORT_WEIGHTS[group as SportGroup]?.label ?? "inny sport";
      return `${label} ${days === "1" ? "wczoraj" : "przedwczoraj"} (obciążenie ${i.value})`;
    }
    case "check_in": {
      const d = i.detail ?? "";
      if (d.startsWith("feeling:")) return FEELING_TEXT[d.slice(8)] ?? "samopoczucie";
      if (i.rating === "ok") return "nogi świeże";
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

const FEELING_TEXT: Record<string, string> = {
  great: "pełnia sił",
  good: "dobre samopoczucie",
  ok: "średnie samopoczucie",
  worse: "gorsze samopoczucie",
  exhausted: "totalne wyczerpanie",
  sick: "choroba",
};

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

// ---------- "Dlaczego dziś to?" (D-048) ----------

export const INPUT_LABEL: Record<ReadinessInput["key"], string> = {
  hrv: "HRV (noc)",
  rhr: "Tętno spoczynkowe",
  sleep: "Sen",
  body_battery: "Body Battery",
  garmin_readiness: "Gotowość Garmina",
  form: "Forma",
  check_in: "Samopoczucie",
  other_sport: "Inne sporty (nogi)",
};

export const RATING_WORD: Record<ReadinessInput["rating"], string> = {
  ok: "ok",
  caution: "uważaj",
  bad: "źle",
  missing: "brak danych",
};

const FEELING_LABEL: Record<string, string> = {
  great: "W pełni sił", good: "Dobrze", ok: "Średnio", worse: "Czuję się gorzej", exhausted: "Totalne wyczerpanie", sick: "Choroba",
};

export interface SignalRow {
  key: ReadinessInput["key"];
  label: string;
  value: string;
  norm: string;
  rating: ReadinessInput["rating"];
  ratingWord: string;
}

/** Every readiness signal with its value and the limits it is judged by. */
export function explainSignals(r: Readiness): SignalRow[] {
  return r.inputs.map((i) => {
    const v = i.value;
    let value = v == null ? "—" : String(v);
    let norm = "";
    switch (i.key) {
      case "hrv":
        value = v == null ? (i.detail === "learning" ? "uczę się" : "—") : `${Math.round(v)} ms`;
        norm = i.baseline != null ? `średnia 60 dni ${i.baseline} ms; uważaj poniżej normy, źle gdy 3+ noce nisko` : "potrzeba 14 nocy danych";
        break;
      case "rhr":
        value = v == null ? (i.detail === "learning" ? "uczę się" : "—") : `${Math.round(v)} ud/min`;
        norm = i.baseline != null ? `średnia 30 dni ${i.baseline}; uważaj +5, źle +8` : "potrzeba 7 dni danych";
        break;
      case "sleep":
        value = v == null ? "—" : `${String(v).replace(".", ",")} h`;
        norm = "uważaj < 6 h, źle < 5 h";
        break;
      case "body_battery":
        norm = "uważaj < 50, źle < 30";
        break;
      case "garmin_readiness":
        norm = "uważaj < 50, źle < 25";
        break;
      case "form":
        value = v == null ? "—" : `${v > 0 ? "+" : ""}${v}% Kondycji`;
        norm = "uważaj < −30%, źle < −45%";
        break;
      case "check_in":
        value = i.detail?.startsWith("feeling:") ? FEELING_LABEL[i.detail.slice(8)] ?? "zapisane" : i.rating === "missing" ? "bez check-inu" : "zapisane";
        norm = "„Czuję się gorzej” = źle; wyczerpanie / choroba = odpoczynek";
        break;
      case "other_sport": {
        const [group, days] = (i.detail ?? "none").split(":");
        value = i.detail === "none" || !days ? "brak" : `${SPORT_WEIGHTS[group as SportGroup]?.label ?? "inny sport"} ${days === "1" ? "wczoraj" : "przedwczoraj"}, obc. ${v}`;
        norm = "bieg / siłownia: uważaj ≥ 40 wczoraj lub ≥ 80 przedwczoraj, źle ≥ 100 wczoraj";
        break;
      }
    }
    return { key: i.key, label: INPUT_LABEL[i.key], value, norm, rating: i.rating, ratingWord: RATING_WORD[i.rating] };
  });
}

/** How the signals turn into a colour, in one line. */
export function readinessRule(r: Readiness): string {
  const bads = r.inputs.filter((i) => i.rating === "bad").length;
  const cautions = r.inputs.filter((i) => i.rating === "caution").length;
  const counted = `${bads}× „źle”, ${cautions}× „uważaj”`;
  if (r.overrides.includes("sick")) return `Choroba zawsze oznacza odpoczynek (${counted}).`;
  if (r.overrides.includes("exhausted")) return `Totalne wyczerpanie zawsze oznacza odpoczynek (${counted}).`;
  const colour = r.effective === "red" ? "czerwony" : r.effective === "yellow" ? "żółty" : "zielony";
  const why = r.effective === "red" ? "co najmniej 2× „źle”" : r.effective === "yellow" ? (bads === 1 ? "1× „źle”" : "co najmniej 2× „uważaj”") : "najwyżej 1× „uważaj” i żadnego „źle”";
  const pain = r.overrides.includes("pain") ? " Aktywny ból: bez mocnych akcentów." : "";
  return `${counted} → ${colour} dzień (${why}). Wynik ${r.score}/100 = 100 − 10 za każde „uważaj” − 25 za każde „źle”.${pain}`;
}
