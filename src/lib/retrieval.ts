import type { Evidence } from "./types";

/** Naive but effective claim extraction: pick informative sentences. */
export function extractClaims(text: string, max = 5): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 350);

  // Prefer sentences with named entities / numbers / strong verbs
  const scored = sentences.map((s) => {
    let score = 0;
    if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(s)) score += 2;     // proper nouns
    if (/\d/.test(s)) score += 2;                             // figures
    if (/(said|claim|report|announce|confirm|deny|reveal)/i.test(s)) score += 1;
    if (/(percent|%|million|billion|killed|elected|signed)/i.test(s)) score += 1;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picks = scored.slice(0, max).map((x) => x.s);
  return picks.length ? picks : sentences.slice(0, max);
}

export function buildSearchQuery(headline: string, claims: string[]): string {
  const base = headline.replace(/[^\w\s]/g, " ").trim();
  if (base.length > 12) return base.slice(0, 200);
  return (claims[0] || "").slice(0, 200);
}

/** Wikipedia REST search — free, no key. */
export async function searchWikipedia(query: string, limit = 4): Promise<Evidence[]> {
  if (!query) return [];
  const url = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "NewsVerdict/1.0" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { pages?: Array<{ key: string; title: string; excerpt: string }> };
    return (data.pages ?? []).map((p) => ({
      source: `Wikipedia — ${p.title}`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.key)}`,
      snippet: stripHtml(p.excerpt),
      support: "neutral" as const,
    }));
  } catch {
    return [];
  }
}

/** DuckDuckGo Instant Answer — free, no key. Limited but real. */
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
      if (t.Text && t.FirstURL && out.length < 5) {
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

/** Tag evidence as supports/contradicts via lexical overlap with claims. */
export function tagEvidence(evidence: Evidence[], claims: string[]): Evidence[] {
  const claimTokens = new Set(
    claims
      .join(" ")
      .toLowerCase()
      .match(/[a-z]{4,}/g) ?? []
  );
  if (!claimTokens.size) return evidence;

  return evidence.map((e) => {
    const tokens = (e.snippet.toLowerCase().match(/[a-z]{4,}/g) ?? []);
    const overlap = tokens.filter((t) => claimTokens.has(t)).length;
    const ratio = tokens.length ? overlap / Math.min(tokens.length, claimTokens.size) : 0;
    const negation = /\b(no|not|never|denied|false|hoax|debunk|misleading)\b/i.test(e.snippet);
    let support: Evidence["support"] = "neutral";
    if (ratio > 0.18) support = negation ? "contradicts" : "supports";
    return { ...e, support };
  });
}
