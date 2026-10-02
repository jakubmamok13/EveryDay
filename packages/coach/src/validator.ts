// Validator for AI text (D-021): clear, Polish, short, and no invented numbers.

const BANNED = [
  "może warto",
  "warto rozważyć",
  "rozważ ",
  "być może",
  "ewentualnie",
  "skonsultuj",
  "jako ai",
  "jako model",
  "jestem modelem",
  "nie jestem lekarzem",
  "pamiętaj, że",
  "zastrzeż",
  "disclaimer",
];

const ENGLISH = ["the", "and", "your", "you", "with", "should", "today", "workout"];

export interface ValidationResult {
  ok: boolean;
  problems: string[];
}

export function normalizeNumber(n: string): string {
  return n.replace(",", ".").replace(/\.0+$/, "");
}

export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map(normalizeNumber);
}

export function validateText(text: unknown, allowedNumbers: Iterable<string>, maxLen: number): ValidationResult {
  const problems: string[] = [];
  if (typeof text !== "string" || !text.trim()) return { ok: false, problems: ["empty"] };
  const t = text.trim();
  if (t.length > maxLen) problems.push("too_long");
  const lower = t.toLowerCase();
  for (const b of BANNED) if (lower.includes(b)) problems.push(`banned:${b.trim()}`);
  const words = lower.split(/[^a-ząćęłńóśźż]+/).filter(Boolean);
  const english = words.filter((w) => ENGLISH.includes(w)).length;
  if (english >= 2) problems.push("not_polish");
  const allowed = new Set([...allowedNumbers].map(normalizeNumber));
  for (const n of numbersIn(t)) if (!allowed.has(n)) problems.push(`number:${n}`);
  if (/[*#`]/.test(t)) problems.push("markdown");
  return { ok: problems.length === 0, problems };
}
