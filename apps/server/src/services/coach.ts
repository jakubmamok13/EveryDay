import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LIBRARY } from "@everyday/library";
import { addDays, type ISODate, type ScaledWorkout } from "@everyday/shared";
import { ENVELOPE_REASON, reduceWorkout, shortenAndCap, shortenTo, type BriefFacts, type Proposal } from "@everyday/engine";
import {
  chunkMarkdown,
  runChat,
  topByEmbedding,
  topByKeywords,
  writeBriefSlots,
  type ChatAction,
  type KnowledgeChunk,
} from "@everyday/coach";
import type { App } from "../app";
import { nowIso } from "../db";
import { activeNotes, dailyState, plannedActiveOn, plannedBetween } from "../repo";
import { applyChange, envelopeCheck, moveWorkout } from "./plan";
import { refreshBrief } from "./daily";

// ---------- Knowledge Base (M11) ----------

export function syncKnowledge(app: App): number {
  const dirs: [string, KnowledgeChunk["source"]][] = [
    [join(app.config.repoRoot, "knowledge", "method-notes"), "method_notes"],
    [join(app.config.repoRoot, "private", "book"), "book"],
  ];
  const seen = new Set<string>();
  let added = 0;
  for (const [dir, source] of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) {
      for (const c of chunkMarkdown(f, readFileSync(join(dir, f), "utf8"), source)) {
        const hash = createHash("sha256").update(c.heading + "\n" + c.text).digest("hex");
        seen.add(hash);
        added += app.db.run(
          "INSERT OR IGNORE INTO knowledge_chunk (source, doc_path, heading, text, content_hash) VALUES (?,?,?,?,?)",
          c.source, c.docPath, c.heading, c.text, hash,
        ).changes;
      }
    }
  }
  for (const r of app.db.all("SELECT id, content_hash FROM knowledge_chunk")) {
    if (!seen.has(r.content_hash)) app.db.run("DELETE FROM knowledge_chunk WHERE id = ?", r.id);
  }
  return added;
}

function chunks(app: App): KnowledgeChunk[] {
  return app.db.all("SELECT * FROM knowledge_chunk").map((r) => ({
    source: r.source,
    docPath: r.doc_path,
    heading: r.heading,
    text: r.text,
    embedding: r.embedding_json ? JSON.parse(r.embedding_json) : null,
  }));
}

export async function embedMissing(app: App): Promise<number> {
  const llm = await app.llm();
  if (!llm) return 0;
  const rows = app.db.all("SELECT id, heading, text FROM knowledge_chunk WHERE embedding_json IS NULL");
  let n = 0;
  for (let i = 0; i < rows.length; i += 16) {
    const batch = rows.slice(i, i + 16);
    try {
      const vecs = await llm.embed(batch.map((r) => `${r.heading}\n${r.text}`));
      batch.forEach((r, j) => vecs[j] && app.db.run("UPDATE knowledge_chunk SET embedding_json = ? WHERE id = ?", JSON.stringify(vecs[j]), r.id));
      n += batch.length;
    } catch {
      return n; // embedding model not pulled: keyword search keeps working
    }
  }
  return n;
}

export async function searchKnowledge(app: App, query: string, k: number): Promise<KnowledgeChunk[]> {
  const all = chunks(app);
  const llm = await app.llm();
  if (llm && all.some((c) => c.embedding)) {
    try {
      const [q] = await llm.embed([query]);
      if (q) return topByEmbedding(q, all, k);
    } catch {
      /* fall through to keywords */
    }
  }
  return topByKeywords(query, all, k);
}

// ---------- Brief ----------

export async function writeBrief(app: App, facts: BriefFacts) {
  const query = [facts.workout?.category.replace("_", " "), facts.workout?.name, facts.readiness.reason, facts.change?.text].filter(Boolean).join(" ");
  const passages = await searchKnowledge(app, query || "regeneracja dzień wolny", 3);
  const llm = await app.llm();
  const res = await writeBriefSlots(facts, passages, llm);
  return { ...res, model: llm ? app.coachSettings().model : null };
}

// ---------- Actions from chat and buttons (Safe Envelope) ----------

export interface ActionResult {
  ok: boolean;
  text: string;
  adaptationId?: number;
  noteId?: number;
}

function overridesFor(app: App, athleteId: number, date: ISODate) {
  const json = dailyState(app, athleteId, date)?.readiness_json;
  return json ? JSON.parse(json).overrides ?? [] : [];
}

export function applyAction(app: App, athleteId: number, a: ChatAction, origin: "chat" | "manual" | "ai"): ActionResult {
  if (a.type === "note") {
    const id = app.db.run(
      "INSERT INTO chat_note (athlete_id, kind, text, start_date, end_date, created_at) VALUES (?,?,?,?,?,?)",
      athleteId, a.noteKind, a.noteText, app.today(), a.endDate, nowIso(),
    ).id;
    return { ok: true, text: `Zapamiętałem: „${a.noteText}” (do ${a.endDate}).`, noteId: id };
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
  const check = envelopeCheck(app, athleteId, row, p, overridesFor(app, athleteId, a.date), origin !== "ai");
  if (origin === "chat" || origin === "ai") {
    app.db.run(
      "INSERT INTO ai_proposal (athlete_id, context, raw_json, verdict, rejection_reasons_json, created_at) VALUES (?,?,?,?,?,?)",
      athleteId, "chat", JSON.stringify(a), check.ok ? "accepted" : "rejected", JSON.stringify(check.reasons), nowIso(),
    );
  }
  if (!check.ok) return { ok: false, text: `Nie mogę: ${check.reasons.map((r) => ENVELOPE_REASON[r] ?? r).join(", ")}.` };
  const reasons = [origin === "manual" ? "manual" : "chat"];
  const id = a.type === "move"
    ? moveWorkout(app, athleteId, row, a.toDate, origin, reasons, label)
    : applyChange(app, athleteId, row, p.workout, origin, a.type === "easier" ? "reduce" : a.type, reasons, label);
  return { ok: true, text: `Zmiana: ${label}.`, adaptationId: id };
}

// ---------- Coach Chat (M10) ----------

export async function chat(app: App, athleteId: number, message: string) {
  const today = app.today();
  app.db.run("INSERT INTO chat_message (athlete_id, role, content, created_at) VALUES (?,?,?,?)", athleteId, "user", message, nowIso());
  const briefRow = app.db.get("SELECT facts_json FROM daily_brief WHERE athlete_id = ? AND date = ?", athleteId, today);
  const planLines = plannedBetween(app, athleteId, today, addDays(today, 6)).map((r) => {
    const w = JSON.parse(r.workout_json) as ScaledWorkout;
    return `${r.date}: ${w.name}, ${w.minutes} min${r.is_key ? " (kluczowy)" : ""}`;
  });
  const history = app.db
    .all("SELECT role, content FROM chat_message WHERE athlete_id = ? ORDER BY id DESC LIMIT 11", athleteId)
    .reverse()
    .slice(0, -1)
    .map((m) => ({ role: m.role === "coach" ? ("assistant" as const) : ("user" as const), content: m.content }));
  const facts = briefRow ? JSON.parse(briefRow.facts_json) : null;
  // "Ten trening" means today's workout: search with its name and type too.
  const passages = await searchKnowledge(app, `${message} ${facts?.workout?.name ?? ""} ${facts?.workout?.category?.replace("_", " ") ?? ""}`, 4);
  const llm = await app.llm();
  const res = await runChat(message, {
    today,
    facts,
    planLines,
    notes: activeNotes(app, athleteId, today),
    history,
    passages,
  }, llm);
  // Notes first, so a reported pain shapes the change that follows.
  const ordered = [...res.actions].sort((x, y) => (x.type === "note" ? -1 : 0) - (y.type === "note" ? -1 : 0));
  const results = ordered.map((a) => applyAction(app, athleteId, a, "chat"));
  if (results.some((r) => r.ok)) await refreshBrief(app, athleteId, today);
  const extra = results.map((r) => r.text).filter((t) => !res.reply.includes(t));
  const reply = [res.reply, ...extra].filter(Boolean).join("\n");
  app.db.run(
    "INSERT INTO chat_message (athlete_id, role, content, meta_json, created_at) VALUES (?,?,?,?,?)",
    athleteId, "coach", reply, JSON.stringify({ source: res.source, results, problems: res.problems }), nowIso(),
  );
  return { reply, source: res.source, changes: results.filter((r) => r.adaptationId).map((r) => ({ adaptationId: r.adaptationId, text: r.text })) };
}
