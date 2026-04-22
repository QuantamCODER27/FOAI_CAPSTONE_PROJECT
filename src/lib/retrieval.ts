import type { Evidence } from "./types";

/** Stronger claim extraction: prioritize sentences with entities, numbers, and reporting verbs. */
export function extractClaims(text: string, max = 6): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 350);

  const scored = sentences.map((s) => {
    let score = 0;
    // Proper-noun sequences (people / orgs / places)
    const propers = s.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g) ?? [];
    score += Math.min(6, propers.length * 2);
    // Numbers, dates, percents
    if (/\b\d{4}\b/.test(s)) score += 2;
    if (/\d/.test(s)) score += 1;
    if (/(%|percent|million|billion|thousand)/i.test(s)) score += 2;
    // Reporting / factual verbs
    if (/\b(said|claim|report|announce|confirm|deny|reveal|warn|admit|allege|found|discovered|launched|signed)\b/i.test(s))
      score += 2;
    // Hard facts
    if (/\b(killed|elected|resigned|arrested|approved|banned|won|lost|died|born)\b/i.test(s)) score += 2;
    // Penalize opinion / sensational
    if (/\b(shocking|unbelievable|miracle|secret|destroyed|exposed|hate)\b/i.test(s)) score -= 2;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picks = scored.slice(0, max).map((x) => x.s);
  return picks.length ? picks : sentences.slice(0, max);
}

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "been", "were", "them",
  "they", "their", "there", "which", "what", "when", "where", "while", "would", "could",
  "should", "about", "into", "than", "then", "some", "such", "also", "more", "most", "over",
  "after", "before", "very", "much", "many", "your", "yours", "ours", "his", "her", "him",
  "she", "you", "are", "was", "but", "not", "all", "any",
]);

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((t) => !STOP.has(t));
}

export function buildSearchQuery(headline: string, claims: string[]): string {
  // Keep proper nouns + numbers from headline + top claim
  const combined = `${headline} ${claims[0] ?? ""}`;
  const propers = combined.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\b/g) ?? [];
  const nums = combined.match(/\b\d{2,4}\b/g) ?? [];
  const base = [...new Set([...propers, ...nums])].join(" ").trim();
  if (base.length > 8) return base.slice(0, 200);
  return headline.replace(/[^\w\s]/g, " ").trim().slice(0, 200);
}

/** Wikipedia REST search. */
export async function searchWikipedia(query: string, limit = 5): Promise<Evidence[]> {
  if (!query) return [];
  const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "NewsVerdict/1.0" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { pages?: Array<{ key: string; title: string; excerpt: string; description?: string }> };
    return (data.pages ?? []).map((p) => ({
      source: `Wikipedia — ${p.title}`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.key)}`,
      snippet: stripHtml(`${p.description ? p.description + ". " : ""}${p.excerpt}`),
      support: "neutral" as const,
    }));
  } catch {
    return [];
  }
}

/** DuckDuckGo Instant Answer. */
export async function searchDuckDuckGo(query: string): Promise<Evidence[]> {
  if (!query) return [];
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const out: Evidence[] = [];
    if (data.AbstractText && data.AbstractURL) {
      out.push({
        source: data.AbstractSource || "DuckDuckGo",
        url: data.AbstractURL,
        snippet: data.AbstractText,
        support: "neutral",
      });
    }
    for (const t of data.RelatedTopics ?? []) {
      if (t.Text && t.FirstURL && out.length < 6) {
        out.push({ source: "DuckDuckGo", url: t.FirstURL, snippet: t.Text, support: "neutral" });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

/** Token-overlap + bigram + negation evidence tagging. */
export function tagEvidence(evidence: Evidence[], claims: string[]): Evidence[] {
  const claimToks = tokens(claims.join(" "));
  const claimSet = new Set(claimToks);
  const claimBigrams = new Set<string>();
  for (let i = 0; i < claimToks.length - 1; i++) claimBigrams.add(`${claimToks[i]} ${claimToks[i + 1]}`);
  if (!claimSet.size) return evidence;

  return evidence.map((e) => {
    const evToks = tokens(e.snippet);
    if (!evToks.length) return e;
    const uniOverlap = evToks.filter((t) => claimSet.has(t)).length;
    let biOverlap = 0;
    for (let i = 0; i < evToks.length - 1; i++) {
      if (claimBigrams.has(`${evToks[i]} ${evToks[i + 1]}`)) biOverlap++;
    }
    const score =
      uniOverlap / Math.max(8, Math.min(evToks.length, claimSet.size)) + biOverlap * 0.15;
    const negation =
      /\b(no evidence|not true|never|denied|false claim|hoax|debunk|misleading|fact[- ]check|fabricated|incorrect)\b/i.test(
        e.snippet
      );
    let support: Evidence["support"] = "neutral";
    if (score > 0.22) support = negation ? "contradicts" : "supports";
    else if (negation && score > 0.1) support = "contradicts";
    return { ...e, support };
  });
}
