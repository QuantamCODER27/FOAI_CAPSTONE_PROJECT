import type { Evidence } from "./types";

export function languageStyleScore(text: string): number {
  let s = 78;
  const len = Math.max(1, text.length);
  const exclam = (text.match(/!/g) ?? []).length;
  const allCaps = (text.match(/\b[A-Z]{4,}\b/g) ?? []).length;
  const sensational = (text.match(
    /\b(shocking|unbelievable|you won't believe|destroyed|exposed|secret|miracle|insane|outrageous|bombshell|breaking)\b/gi
  ) ?? []).length;
  const clickbait = (text.match(/\b(doctors hate|big pharma|they don't want you|share before|gone viral)\b/gi) ?? []).length;
  const questionMarks = (text.match(/\?/g) ?? []).length;
  const ellipsis = (text.match(/\.{3,}/g) ?? []).length;

  s -= Math.min(25, exclam * 3);
  s -= Math.min(20, allCaps * 4);
  s -= Math.min(35, sensational * 7);
  s -= Math.min(30, clickbait * 12);
  s -= Math.min(10, questionMarks * 2);
  s -= Math.min(8, ellipsis * 3);

  // Reward longer, paragraph-style writing
  if (len > 600) s += 4;
  if (len > 1500) s += 4;

  return Math.max(0, Math.min(100, s));
}

const TRUST_TIERS: Array<{ pat: RegExp; weight: number }> = [
  { pat: /(reuters\.com|apnews\.com|bbc\.|nytimes\.com|washingtonpost\.com|theguardian\.com|wsj\.com|ft\.com|economist\.com|npr\.org|aljazeera\.com)/i, weight: 1.0 },
  { pat: /(nature\.com|science\.org|nih\.gov|who\.int|cdc\.gov|nasa\.gov|esa\.int|noaa\.gov)/i, weight: 1.0 },
  { pat: /(wikipedia\.org)/i, weight: 0.7 },
  { pat: /(snopes\.com|politifact\.com|factcheck\.org|fullfact\.org)/i, weight: 0.95 },
  { pat: /(\.gov|\.edu)/i, weight: 0.85 },
];

export function sourceQualityScore(evidence: Evidence[]): number {
  if (!evidence.length) return 28;
  let total = 0;
  for (const e of evidence) {
    const tier = TRUST_TIERS.find((t) => t.pat.test(e.url));
    total += tier?.weight ?? 0.35;
  }
  const avg = total / evidence.length;
  return Math.round(Math.min(100, 35 + avg * 65));
}
