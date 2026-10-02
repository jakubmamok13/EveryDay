import { addDays, type ChatNote, type ISODate, type NoteKind } from "@everyday/shared";
import type { BriefFacts } from "@everyday/engine";
import { formatPassages, type KnowledgeChunk } from "./knowledge";
import type { ChatMessage, LlmClient } from "./ollama";
import { CHAT_SCHEMA, CHAT_SYSTEM } from "./prompts";
import { numbersIn, validateText } from "./validator";

export type ChatAction =
  | { type: "shorten"; date: ISODate; minutes: number }
  | { type: "easier"; date: ISODate }
  | { type: "rest"; date: ISODate }
  | { type: "move"; date: ISODate; toDate: ISODate }
  | { type: "note"; noteKind: NoteKind; noteText: string; endDate: ISODate };

export interface ChatContext {
  today: ISODate;
  facts: BriefFacts | null;
  /** Human-readable plan lines for the next days. */
  planLines: string[];
  notes: ChatNote[];
  history: ChatMessage[];
  passages: KnowledgeChunk[];
}

export interface ChatResult {
  reply: string;
  actions: ChatAction[];
  source: "ai" | "rules";
  problems: string[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = new Set(["injury", "illness", "travel", "other"]);

export function sanitizeActions(raw: unknown, today: ISODate): ChatAction[] {
  if (!Array.isArray(raw)) return [];
  const max = addDays(today, 13);
  const inRange = (d: unknown): d is ISODate => typeof d === "string" && ISO.test(d) && d >= today && d <= max;
  const out: ChatAction[] = [];
  for (const a of raw.slice(0, 3)) {
    if (!a || typeof a !== "object") continue;
    const x = a as Record<string, unknown>;
    const date = inRange(x.date) ? x.date : today;
    switch (x.type) {
      case "shorten":
        if (typeof x.minutes === "number" && x.minutes >= 15) out.push({ type: "shorten", date, minutes: Math.round(x.minutes) });
        break;
      case "easier":
      case "rest":
        out.push({ type: x.type, date });
        break;
      case "move":
        if (inRange(x.toDate)) out.push({ type: "move", date, toDate: x.toDate });
        break;
      case "note":
        if (typeof x.noteKind === "string" && KINDS.has(x.noteKind) && typeof x.noteText === "string" && x.noteText.trim()) {
          out.push({
            type: "note",
            noteKind: x.noteKind as NoteKind,
            noteText: x.noteText.trim().slice(0, 200),
            endDate: typeof x.endDate === "string" && ISO.test(x.endDate) && x.endDate >= today ? x.endDate : addDays(today, 7),
          });
        }
        break;
    }
  }
  return out;
}

function contextBlock(ctx: ChatContext): string {
  const facts = ctx.facts
    ? { dzis: ctx.facts.workout?.name ?? "wolne", minuty: ctx.facts.workout?.minutes, cel: ctx.facts.workout?.target, gotowosc: ctx.facts.readiness.word, powod: ctx.facts.readiness.reason, jutro: ctx.facts.tomorrow }
    : null;
  const notes = ctx.notes.map((n) => `${n.kind}: ${n.text} (do ${n.endDate})`);
  return [
    `DZISIAJ: ${ctx.today}`,
    `FAKTY: ${JSON.stringify(facts)}`,
    `PLAN:\n${ctx.planLines.join("\n")}`,
    `PAMIĘTAM:\n${notes.join("\n") || "—"}`,
    `WIEDZA:\n${formatPassages(ctx.passages)}`,
  ].join("\n\n");
}

export async function runChat(message: string, ctx: ChatContext, llm: LlmClient | null): Promise<ChatResult> {
  if (!llm) return ruleBasedChat(message, ctx);
  const allowed = [
    ...(ctx.facts?.numbers ?? []),
    ...numbersIn(ctx.planLines.join(" ")),
    ...numbersIn(formatPassages(ctx.passages)),
    ...numbersIn(message),
    ...numbersIn(ctx.notes.map((n) => n.text + n.endDate).join(" ")),
  ];
  const messages: ChatMessage[] = [
    { role: "system", content: CHAT_SYSTEM },
    { role: "user", content: contextBlock(ctx) },
    ...ctx.history.slice(-10),
    { role: "user", content: message },
  ];
  const problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await llm.json<{ reply?: unknown; actions?: unknown }>(messages, CHAT_SCHEMA, { temperature: attempt ? 0.2 : 0.5 });
      const v = validateText(out.reply, allowed, 700);
      if (v.ok) return { reply: String(out.reply).trim(), actions: sanitizeActions(out.actions, ctx.today), source: "ai", problems };
      problems.push(...v.problems);
    } catch (e) {
      problems.push(`llm: ${(e as Error).message}`);
    }
  }
  const fallback = ruleBasedChat(message, ctx);
  return { ...fallback, problems };
}

/** Works without any AI ("no AI" mode and fallback): simple Polish intents. */
export function ruleBasedChat(message: string, ctx: ChatContext): ChatResult {
  const m = message.toLowerCase();
  const today = ctx.today;
  const minutes = m.match(/(\d{2,3})\s*(min|minut)/);
  const done = (reply: string, actions: ChatAction[] = []): ChatResult => ({ reply, actions, source: "rules", problems: [] });

  if (/chor|gorączk|przezięb|gryp|infekc/.test(m)) {
    return done("Zdrowie najpierw: dziś odpoczynek, zapisałem chorobę na 3 dni. Po chorobie wrócimy spokojnie.", [
      { type: "rest", date: today },
      { type: "note", noteKind: "illness", noteText: message.slice(0, 200), endDate: addDays(today, 3) },
    ]);
  }
  if (/boli|ból|kontuzj|naciągn|uraz/.test(m)) {
    return done("Zapisałem ból na tydzień — do tego czasu tylko spokojne jazdy. Daj znać, gdy przejdzie.", [
      { type: "easier", date: today },
      { type: "note", noteKind: "injury", noteText: message.slice(0, 200), endDate: addDays(today, 7) },
    ]);
  }
  if (minutes && /(tylko|mam|zdąż|czasu)/.test(m)) {
    const n = Number(minutes[1]);
    return done("", [{ type: "shorten", date: today, minutes: n }]);
  }
  if (/wyjazd|wyjeżdżam|urlop|delegac/.test(m)) {
    return done("Zapisałem wyjazd na 7 dni. Jeśli w tym czasie nie możesz jeździć, zmień dostępność w Ustawieniach.", [
      { type: "note", noteKind: "travel", noteText: message.slice(0, 200), endDate: addDays(today, 7) },
    ]);
  }
  if (/zmęcz|ciężkie nogi|nie mam siły|padnięt|słabo/.test(m)) {
    return done("Rozumiem — dziś lżejsza wersja treningu.", [{ type: "easier", date: today }]);
  }
  if (/odpocz|wolne|pomiń|pomijam|nie dam rady/.test(m)) {
    return done("OK, dziś odpoczynek.", [{ type: "rest", date: today }]);
  }
  const w = ctx.facts?.workout;
  if (w && /(dlaczego|po co|czemu).*(ten|dzisiejsz|dziś|trening)/.test(m)) {
    return done(`${w.name}: ${w.purpose}`);
  }
  const best = ctx.passages[0];
  if (best && /dlaczego|po co|czemu|jak |co to|ile /.test(m + " ")) {
    const sentences = best.text.replace(/\n+/g, " ").replace(/\*\*/g, "").split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
    const topic = best.heading.split(" — ").pop() ?? best.heading;
    return done(`${topic}: ${sentences}`);
  }
  return done(
    "Mogę: skrócić trening („mam tylko 45 min”), zrobić go lżejszym („ciężkie nogi”), dać wolne, zapamiętać ból, chorobę albo wyjazd i wyjaśnić, po co jest dany trening.",
  );
}
