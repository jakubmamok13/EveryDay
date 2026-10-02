import type { BriefFacts, BriefSlots } from "@everyday/engine";
import { formatPassages, type KnowledgeChunk } from "./knowledge";
import type { LlmClient } from "./ollama";
import { BRIEF_SCHEMA, BRIEF_SYSTEM } from "./prompts";
import { validateText } from "./validator";

type SlotKey = "focus" | "offBike" | "change";

export interface BriefWriteResult {
  slots: BriefSlots;
  sources: Partial<Record<SlotKey, "ai" | "template">>;
  validatorPassed: boolean;
  problems: string[];
}

export const SLOT_MAX = 160;

function factsForPrompt(f: BriefFacts) {
  return {
    data: f.date,
    dzien_wolny: f.restDay,
    trening: f.workout
      ? { nazwa: f.workout.name, minuty: f.workout.minutes, gdzie: f.workout.modeLabel, cel_mocy_lub_tetna: f.workout.target, typ: f.workout.category, po_co: f.workout.purpose }
      : null,
    gotowosc: { stan: f.readiness.word, powod: f.readiness.reason },
    zmiana_planu: f.change?.text ?? null,
    jedzenie: f.fueling ?? null,
    jutro: f.tomorrow,
    szablony: f.templates,
  };
}

/**
 * The AI writes only the text slots; every slot is validated and falls back
 * to the template, so the brief always arrives (08 §1).
 */
export async function writeBriefSlots(facts: BriefFacts, passages: KnowledgeChunk[], llm: LlmClient | null): Promise<BriefWriteResult> {
  const wanted: SlotKey[] = [];
  if (facts.workout) wanted.push("focus");
  wanted.push("offBike");
  if (facts.change) wanted.push("change");

  const result: BriefWriteResult = { slots: {}, sources: {}, validatorPassed: true, problems: [] };
  if (!llm) {
    for (const k of wanted) result.sources[k] = "template";
    return result;
  }

  const allowed = facts.numbers;
  const messages = [
    { role: "system" as const, content: BRIEF_SYSTEM },
    {
      role: "user" as const,
      content: `FAKTY:\n${JSON.stringify(factsForPrompt(facts), null, 1)}\n\nWIEDZA:\n${formatPassages(passages)}`,
    },
  ];
  const pending = new Set<SlotKey>(wanted);
  for (let attempt = 0; attempt < 2 && pending.size > 0; attempt++) {
    try {
      const out = await llm.json<Record<string, unknown>>(
        attempt === 0 ? messages : [...messages, { role: "user", content: "Popraw: krócej, tylko liczby z FAKTÓW, bez asekuracji." }],
        BRIEF_SCHEMA,
        { temperature: attempt === 0 ? 0.4 : 0.2 },
      );
      for (const k of [...pending]) {
        const v = validateText(out[k], allowed, SLOT_MAX);
        if (v.ok) {
          result.slots[k] = String(out[k]).trim().replace(/^[-–•]\s*/, "");
          result.sources[k] = "ai";
          pending.delete(k);
        } else {
          result.problems.push(`${k}: ${v.problems.join(",")}`);
        }
      }
    } catch (e) {
      result.problems.push(`llm: ${(e as Error).message}`);
    }
  }
  for (const k of pending) {
    result.sources[k] = "template";
    result.validatorPassed = false;
  }
  return result;
}
