import { LIBRARY } from "@everyday/library";
import { addDays, type ISODate, type NoteKind, type ScaledWorkout } from "@everyday/shared";
import { ENVELOPE_REASON, reduceWorkout, shortenAndCap, shortenTo, type Proposal } from "@everyday/engine";
import type { App } from "../app";
import { nowIso } from "../db";
import { chunkMarkdown, topByKeywords, type KnowledgeChunk } from "../knowledge";
import { activeNotes, dailyState, plannedActiveOn, plannedBetween } from "../repo";
import { refreshBrief } from "./daily";
import { applyChange, envelopeCheck, moveWorkout } from "./plan";

// Buttons instead of chat (D-044): every action goes through the same safety
// checks (Safe Envelope) and is undoable from Today.

export type Action =
  | { type: "shorten"; date: ISODate; minutes: number }
  | { type: "easier"; date: ISODate }
  | { type: "rest"; date: ISODate }
  | { type: "move"; date: ISODate; toDate: ISODate }
  | { type: "note"; noteKind: NoteKind; noteText: string; endDate: ISODate; startDate?: ISODate };

// ---------- Knowledge Base: bundled Method Notes ----------

let cache: { notes: App["config"]["notes"]; chunks: KnowledgeChunk[] } | null = null;

export function knowledge(app: App): KnowledgeChunk[] {
  if (cache?.notes !== app.config.notes) {
    cache = { notes: app.config.notes, chunks: app.config.notes.flatMap((n) => chunkMarkdown(n.path.split("/").pop() ?? n.path, n.text)) };
  }
  return cache.chunks;
}

export function searchKnowledge(app: App, query: string, k: number): KnowledgeChunk[] {
  return topByKeywords(query, knowledge(app), k);
}

const CATEGORY_QUERY: Record<string, string> = {
  recovery: "Regeneracja", endurance: "Wytrzymałość Z2", tempo: "Tempo", sweet_spot: "Sweet Spot",
  threshold: "Próg Z4", vo2max: "VO2max Z5", anaerobic: "Beztlenowe sprinty", test: "Test rampowy FTP", long_ride: "Długa jazda 200 km",
};

/** "Dlaczego ten trening?" — purpose + the matching note sections. */
export function whyToday(app: App, athleteId: number) {
  const row = plannedActiveOn(app, athleteId, app.today());
  if (!row) return { workout: null, sections: searchKnowledge(app, "regeneracja sen odpoczynek", 2) };
  const w = JSON.parse(row.workout_json) as ScaledWorkout;
  return {
    workout: { name: w.name, purpose: w.purpose, cue: w.cue, category: w.category },
    sections: searchKnowledge(app, CATEGORY_QUERY[w.category] ?? w.name, 2),
  };
}

// ---------- Actions from buttons (Safe Envelope) ----------

export interface ActionResult {
  ok: boolean;
  text: string;
  adaptationId?: number;
  noteId?: number;
}

const shortDate = (d: ISODate) => `${Number(d.slice(8, 10))}.${d.slice(5, 7)}`;

function overridesFor(app: App, athleteId: number, date: ISODate) {
  const json = dailyState(app, athleteId, date)?.readiness_json;
  return json ? JSON.parse(json).overrides ?? [] : [];
}

export function applyAction(app: App, athleteId: number, a: Action, origin: "manual" | "engine" = "manual"): ActionResult {
  if (a.type === "note") {
    const id = app.db.run(
      "INSERT INTO chat_note (athlete_id, kind, text, start_date, end_date, created_at) VALUES (?,?,?,?,?,?)",
      athleteId, a.noteKind, a.noteText, a.startDate ?? app.today(), a.endDate, nowIso(),
    ).id;
    return { ok: true, text: `Zapamiętałem: „${a.noteText}” (do ${shortDate(a.endDate)}).`, noteId: id };
  }
  const row = plannedActiveOn(app, athleteId, a.date);
  if (!row || row.status !== "planned") return { ok: false, text: `Nie mogę: ${ENVELOPE_REASON.no_planned_workout}.` };
  const w = JSON.parse(row.workout_json) as ScaledWorkout;
  const def = LIBRARY.find((d) => d.slug === w.slug);
  let p: Proposal;
  let label: string;
  switch (a.type) {
    case "shorten": {
      if (w.minutes <= a.minutes) return { ok: true, text: `„${w.name}” trwa ${w.minutes} min — mieści się w ${a.minutes} min, bez zmian.` };
      const nw = shortenTo(w, a.minutes, def);
      p = { date: a.date, fromDate: a.date, workout: nw };
      label = `${w.name} → ${nw.name} (${nw.minutes} min)`;
      break;
    }
    case "easier": {
      // With an active pain/injury note "easier" means an easy Z2 ride (02 M10).
      const pain = activeNotes(app, athleteId, a.date).some((n) => n.kind === "injury") || overridesFor(app, athleteId, a.date).includes("pain");
      const nw = pain ? shortenAndCap(w, Math.min(1, 60 / w.minutes)) : row.is_key ? reduceWorkout(w) : shortenAndCap(w, 0.75);
      p = { date: a.date, fromDate: a.date, workout: nw };
      label = `lżejsza wersja: ${nw.name}`;
      break;
    }
    case "rest":
      p = { date: a.date, fromDate: a.date, workout: null };
      label = `odpoczynek zamiast „${w.name}”`;
      break;
    case "move":
      p = { date: a.toDate, fromDate: a.date, workout: w };
      label = `„${w.name}” przeniesiony na ${a.toDate}`;
      break;
  }
  const check = envelopeCheck(app, athleteId, row, p, overridesFor(app, athleteId, a.date), true);
  if (!check.ok) return { ok: false, text: `Nie mogę: ${check.reasons.map((r) => ENVELOPE_REASON[r] ?? r).join(", ")}.` };
  const reasons = ["manual"];
  const id = a.type === "move"
    ? moveWorkout(app, athleteId, row, a.toDate, origin, reasons, label)
    : applyChange(app, athleteId, row, p.workout, origin, a.type === "easier" ? "reduce" : a.type, reasons, label);
  return { ok: true, text: `Zmiana: ${label}.`, adaptationId: id };
}

// ---------- Composite buttons ----------

/** "Coś boli" + body part: remember it for a week and make today easy. */
export async function reportPain(app: App, athleteId: number, part: string): Promise<ActionResult[]> {
  const today = app.today();
  const results = [applyAction(app, athleteId, { type: "note", noteKind: "injury", noteText: `Ból: ${part}`, endDate: addDays(today, 7) })];
  if (plannedActiveOn(app, athleteId, today)?.status === "planned") results.push(applyAction(app, athleteId, { type: "easier", date: today }));
  await refreshBrief(app, athleteId, today);
  return results;
}

/** "Wyjazd": no workouts on those days (planned ones are skipped, undoable one by one). */
export async function reportTravel(app: App, athleteId: number, fromDate: ISODate, days: number): Promise<ActionResult[]> {
  const to = addDays(fromDate, days - 1);
  const results = [applyAction(app, athleteId, { type: "note", noteKind: "travel", noteText: `Wyjazd ${fromDate} – ${to}`, startDate: fromDate, endDate: to })];
  for (const r of plannedBetween(app, athleteId, fromDate, to)) {
    if (r.status === "planned") results.push(applyAction(app, athleteId, { type: "rest", date: r.date }));
  }
  if (fromDate <= app.today()) await refreshBrief(app, athleteId, app.today());
  return results;
}

/** One action from a button, then refresh today's brief. */
export async function act(app: App, athleteId: number, a: Action): Promise<ActionResult> {
  const r = applyAction(app, athleteId, a);
  if (r.ok) await refreshBrief(app, athleteId, app.today());
  return r;
}
