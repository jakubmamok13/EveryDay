import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BriefFacts } from "@everyday/engine";
import { chunkMarkdown, ruleBasedChat, runChat, sanitizeActions, topByKeywords, validateText, writeBriefSlots, type LlmClient } from "../src";

const NOTES_DIR = join(__dirname, "../../../knowledge/method-notes");
const CHUNKS = readdirSync(NOTES_DIR).flatMap((f) => chunkMarkdown(f, readFileSync(join(NOTES_DIR, f), "utf8")));

const FACTS: BriefFacts = {
  date: "2026-10-05",
  restDay: false,
  withCheckIn: true,
  readiness: { state: "green", score: 100, emoji: "🟢", word: "dobra", reason: "HRV w normie, nogi świeże" },
  workout: { name: "Sweet Spot 3×12 min", minutes: 60, rideMode: "indoor", modeLabel: "W domu (MyWhoosh)", target: "243 W", category: "sweet_spot", intensity: "hard", purpose: "FTP" },
  tomorrow: "wolne.",
  templates: { focus: "równe 243 W w blokach, kadencja 90+.", offBike: "sen przed 23:00." },
  numbers: ["3", "12", "60", "243", "90", "23", "00", "100", "2026", "10", "05"],
};

function fakeLlm(responses: unknown[]): LlmClient & { calls: number } {
  const c = {
    calls: 0,
    async json<T>(): Promise<T> {
      const r = responses[Math.min(c.calls++, responses.length - 1)];
      if (r instanceof Error) throw r;
      return r as T;
    },
    async embed() {
      return [];
    },
    async health() {
      return { ok: true };
    },
  };
  return c;
}

describe("validator", () => {
  it("accepts clear Polish text with known numbers", () => {
    expect(validateText("Trzymaj równe 243 W i kadencję 90.", FACTS.numbers, 160).ok).toBe(true);
  });
  it("rejects invented numbers, hedging and English", () => {
    expect(validateText("Trzymaj 260 W.", FACTS.numbers, 160).problems).toContain("number:260");
    expect(validateText("Może warto dziś odpuścić.", FACTS.numbers, 160).problems.join()).toContain("banned");
    expect(validateText("Keep the power steady and enjoy your workout.", FACTS.numbers, 160).problems).toContain("not_polish");
  });
});

describe("brief writer", () => {
  it("uses valid AI slots", async () => {
    const llm = fakeLlm([{ focus: "Równo 243 W w każdym bloku, bez zrywów.", offBike: "Kolacja z ryżem i sen przed 23:00." }]);
    const r = await writeBriefSlots(FACTS, [], llm);
    expect(r.sources).toEqual({ focus: "ai", offBike: "ai" });
    expect(r.validatorPassed).toBe(true);
  });
  it("retries once, then falls back to the template for a bad slot", async () => {
    const llm = fakeLlm([
      { focus: "Jedź 280 W!", offBike: "Sen przed 23:00." },
      { focus: "Może warto jechać 280 W.", offBike: "Sen przed 23:00." },
    ]);
    const r = await writeBriefSlots(FACTS, [], llm);
    expect(llm.calls).toBe(2);
    expect(r.sources.focus).toBe("template");
    expect(r.sources.offBike).toBe("ai");
    expect(r.validatorPassed).toBe(false);
  });
  it("survives an AI outage", async () => {
    const r = await writeBriefSlots(FACTS, [], fakeLlm([new Error("connect ECONNREFUSED")]));
    expect(r.sources.focus).toBe("template");
    expect(r.problems.join()).toContain("ECONNREFUSED");
  });
});

describe("knowledge", () => {
  it("chunks Method Notes by heading", () => {
    expect(CHUNKS.length).toBeGreaterThan(25);
    expect(CHUNKS.some((c) => c.heading.includes("Sweet Spot"))).toBe(true);
  });
  it("finds the right note by keywords", () => {
    const top = topByKeywords("dlaczego sweet spot", CHUNKS, 2);
    expect(top[0]!.heading).toContain("Sweet Spot");
    expect(topByKeywords("ile jeść na długiej jeździe węglowodany", CHUNKS, 1)[0]!.docPath).toBe("07-jedzenie-i-picie.md");
  });
});

describe("chat", () => {
  const ctx = { today: "2026-10-05", facts: FACTS, planLines: [], notes: [], history: [], passages: CHUNKS.slice(0, 2) };

  it("rule-based: short on time", () => {
    const r = ruleBasedChat("Mam dziś tylko 45 min", ctx);
    expect(r.actions).toEqual([{ type: "shorten", date: "2026-10-05", minutes: 45 }]);
  });
  it("rule-based: 'why this workout' explains today's workout", () => {
    const r = ruleBasedChat("Dlaczego ten trening?", ctx);
    expect(r.reply).toBe("Sweet Spot 3×12 min: FTP");
  });
  it("rule-based: pain becomes a note and an easier day", () => {
    const r = ruleBasedChat("Boli mnie kolano", ctx);
    expect(r.actions.map((a) => a.type)).toEqual(["easier", "note"]);
  });
  it("rule-based: illness means rest", () => {
    const r = ruleBasedChat("Chyba jestem chory", ctx);
    expect(r.actions[0]).toEqual({ type: "rest", date: "2026-10-05" });
  });
  it("AI chat: actions are sanitized to safe dates and kinds", () => {
    const acts = sanitizeActions(
      [{ type: "move", date: "2026-10-05", toDate: "2027-01-01" }, { type: "shorten", date: "2026-10-06", minutes: 40 }, { type: "launch" }],
      "2026-10-05",
    );
    expect(acts).toEqual([{ type: "shorten", date: "2026-10-06", minutes: 40 }]);
  });
  it("AI chat: invalid replies fall back to rules", async () => {
    const llm = fakeLlm([{ reply: "You should rest today and the workout...", actions: [] }]);
    const r = await runChat("Mam tylko 45 min", ctx, llm);
    expect(r.source).toBe("rules");
    expect(r.actions[0]).toMatchObject({ type: "shorten", minutes: 45 });
  });
  it("AI chat: valid reply passes", async () => {
    const llm = fakeLlm([{ reply: "Jasne, skracam do 45 min.", actions: [{ type: "shorten", date: "2026-10-05", minutes: 45 }] }]);
    const r = await runChat("Mam tylko 45 min", ctx, llm);
    expect(r.source).toBe("ai");
    expect(r.actions).toHaveLength(1);
  });
});
