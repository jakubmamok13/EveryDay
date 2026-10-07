import { addDays, mondayOf, WEEKDAY_PL_LONG, weekday, type ISODate, type Readiness, type ScaledWorkout } from "@everyday/shared";
import { explainSignals, readinessRule, SPORT_WEIGHTS, type SignalRow, type SportGroup } from "@everyday/engine";
import type { App } from "../app";
import { availability, checkIn, dailyState, plannedActiveOn } from "../repo";
import { computeReadinessFor } from "./daily";
import { countsOtherSports } from "./sync";

// "Dlaczego dziś to?" (D-048): the whole chain behind today's plan —
// plan of the block → readiness signals → rule → change — in plain Polish.

const FOCUS_PL: Record<string, string> = {
  sweet_spot: "Sweet Spot", threshold: "Próg", vo2max: "VO2max", base: "Baza", build: "Budowanie", peak: "Szczyt formy", taper: "Taper",
};
const KIND_PL: Record<string, string> = { load: "tydzień budowania", recovery: "tydzień regeneracyjny (lżejszy)", taper: "tydzień przed startem" };
const ROLE_PL: Record<string, string> = {
  quality: "trening kluczowy — jakość, akcent bloku",
  long: "długa jazda — wytrzymałość, kluczowa dla długich tras",
  endurance: "spokojna wytrzymałość — objętość bez dużego zmęczenia",
  recovery: "regeneracja — luźne kręcenie",
  test: "test FTP — sprawdzenie postępu na koniec bloku",
  bonus: "dodatkowa jazda (Mam dziś czas)",
  long_ride_day: "Dzień długiej jazdy — krok w stronę celu",
};

/** What the engine does for each colour (02 M5.3). */
function ruleFor(isKey: boolean | null): Record<"green" | "yellow" | "red", string> {
  if (isKey === null) return { green: "dzień wolny", yellow: "dzień wolny", red: "dzień wolny" };
  return isKey
    ? { green: "trening bez zmian", yellow: "ta sama struktura, −1 powtórzenie lub −3% mocy", red: "regeneracja 30–45 min albo wolne; trening kluczowy próbuje przenieść się na wolny dzień w tym tygodniu" }
    : { green: "trening bez zmian", yellow: "krócej o 25% i tylko do Z2", red: "wolne albo regeneracja ≤ 45 min" };
}

export interface WhyView {
  date: ISODate;
  plan: { lines: string[] };
  signals: SignalRow[];
  rule: string;
  decision: { lines: string[]; whatIf: string[] };
  load: { lines: string[]; otherSports: { label: string; sessions: number; load: number }[]; counted: boolean };
}

export function whyView(app: App, athleteId: number): WhyView {
  const date = app.today();
  // The stored readiness is the one today's brief and decision used.
  const stored = dailyState(app, athleteId, date)?.readiness_json;
  const r: Readiness = stored ? JSON.parse(stored) : computeReadinessFor(app, athleteId, date, !!checkIn(app, athleteId, date));
  const row = plannedActiveOn(app, athleteId, date);
  const w = row ? (JSON.parse(row.workout_json) as ScaledWorkout) : null;
  const day = availability(app, athleteId).days.find((d) => d.weekday === weekday(date));
  const weekStart = mondayOf(date);
  const week = app.db.get(
    "SELECT pw.*, tp.id AS plan FROM plan_week pw JOIN training_plan tp ON tp.id = pw.plan_id WHERE tp.athlete_id = ? AND tp.status = 'active' AND pw.week_start = ?",
    athleteId, weekStart,
  );
  const weekInBlock = week
    ? app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM plan_week WHERE plan_id = ? AND block_index = ? AND week_start <= ?", week.plan, week.block_index, weekStart)!.n
    : null;
  const changes = app.db.all(
    "SELECT text, origin, action, reason_codes_json FROM adaptation WHERE athlete_id = ? AND date = ? AND undone_at IS NULL ORDER BY id",
    athleteId, date,
  );
  const skipped = app.db.get("SELECT workout_json FROM planned_workout WHERE athlete_id = ? AND date = ? AND status = 'skipped' ORDER BY id DESC LIMIT 1", athleteId, date);

  // ---------- 1. Plan ----------
  const plan: string[] = [];
  if (week) {
    plan.push(`Blok ${week.block_index + 1}: akcent ${FOCUS_PL[week.focus] ?? week.focus}, ${week.kind === "load" && weekInBlock ? `tydzień ${weekInBlock} z 3 budujących` : KIND_PL[week.kind] ?? week.kind}. Plan tygodnia: obciążenie ${Math.round(week.target_load)}.`);
    if (week.kind === "recovery") plan.push("Co 4. tydzień jest lżejszy: organizm buduje formę w odpoczynku po 3 tygodniach pracy.");
  }
  const name = WEEKDAY_PL_LONG[weekday(date)] ?? "";
  const dayName = name.charAt(0).toUpperCase() + name.slice(1);
  if (row && w) {
    plan.push(`${dayName}: ${ROLE_PL[row.role] ?? row.role}${row.is_key ? " (★ kluczowy)" : ""}. Limit dnia: ${day?.maxMinutes ?? w.minutes} min.`);
    plan.push(`„${w.name}” (${w.minutes} min, obciążenie ${w.load}): ${w.purpose}`);
  } else if (skipped) {
    plan.push(`Na dziś był „${JSON.parse(skipped.workout_json).name}”, ale został odwołany (powód niżej).`);
  } else if (!day?.available) {
    plan.push(`${dayName} jest dniem wolnym w Twojej dostępności (Ustawienia › Dostępność).`);
  } else {
    plan.push("Plan nie przewiduje dziś jazdy: obciążenie tygodnia jest już rozłożone na inne dni, a dwa mocne dni z rzędu są zabronione.");
  }

  // ---------- 3. Decision ----------
  const rules = ruleFor(row ? !!row.is_key : skipped ? true : null);
  const decision: string[] = [];
  const colour = r.effective === "red" ? "czerwony" : r.effective === "yellow" ? "żółty" : "zielony";
  if (r.state === "learning") decision.push("Okres nauki (pierwsze 14 dni): HRV i tętno spoczynkowe jeszcze się nie liczą, bo nie znam Twojej normy.");
  if (changes.length) {
    for (const c of changes) {
      const who = c.origin === "engine" ? "Automatycznie" : c.origin === "bonus" ? "Twój wybór" : "Twoja zmiana";
      decision.push(`${who}: ${c.text}.`);
    }
  } else if (row || skipped) {
    decision.push(`Dzień ${colour} → ${rules[r.effective === "red" ? "red" : r.effective]}${r.effective === "green" ? "" : " — ale zmiana została cofnięta albo nie była potrzebna"}.`);
  } else {
    decision.push("Dziś odpoczynek: regeneracja też buduje formę. Masz czas? „Mam dziś czas” na ekranie Dziś doda spokojną jazdę, która nie zaszkodzi kolejnemu kluczowemu treningowi.");
  }
  const whatIf = row
    ? [
        `Zielony (najwyżej 1× „uważaj”): ${rules.green}.`,
        `Żółty (1× „źle” albo 2× „uważaj”): ${rules.yellow}.`,
        `Czerwony (2× „źle”, choroba, wyczerpanie): ${rules.red}.`,
      ]
    : [];

  // ---------- 4. Load ----------
  const st = dailyState(app, athleteId, date);
  const counted = countsOtherSports(app);
  const load: string[] = [];
  if (st?.fitness != null) {
    load.push(`Kondycja ${Math.round(st.fitness)} · Zmęczenie ${Math.round(st.fatigue)} · Forma ${st.form_pct != null ? `${st.form_pct > 0 ? "+" : ""}${Math.round(st.form_pct * 100)}%` : Math.round(st.form)}.`);
  }
  const others = app.db.all<{ sport: SportGroup; n: number; l: number }>(
    "SELECT sport, COUNT(*) AS n, SUM(load) AS l FROM activity WHERE athlete_id = ? AND sport <> 'ride' AND is_master = 1 AND date BETWEEN ? AND ? GROUP BY sport ORDER BY l DESC",
    athleteId, addDays(date, -7), addDays(date, -1),
  );
  if (counted) {
    load.push("Liczę wszystkie sporty: do Kondycji i Zmęczenia wlicza się ta część treningu, która przenosi się na rower (bieg 60%, inne wytrzymałościowe 50%, marsz 30%, pływanie 20%, siłownia i joga 0%). Zmęczenie nóg po biegu lub siłowni ocenia Gotowość.");
  } else {
    load.push("Liczę tylko jazdy rowerowe (inne sporty wyłączone w Ustawieniach). Zmęczenie po nich widać tylko pośrednio: w HRV, tętnie i śnie.");
  }

  return {
    date,
    plan: { lines: plan },
    signals: explainSignals(r).filter((s) => s.rating !== "missing" || s.key === "check_in" || s.key === "hrv"),
    rule: readinessRule(r),
    decision: { lines: decision, whatIf },
    load: {
      lines: load,
      otherSports: others.map((o) => ({ label: SPORT_WEIGHTS[o.sport]?.label ?? o.sport, sessions: o.n, load: Math.round(o.l ?? 0) })),
      counted,
    },
  };
}
