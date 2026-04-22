import { createServerFn } from "@tanstack/react-start";
import type { Evidence, TrustSignals, Verdict, VerdictResult } from "@/lib/types";
import {
  buildSearchQuery,
  extractClaims,
  searchDuckDuckGo,
  searchWikipedia,
  tagEvidence,
} from "@/lib/retrieval";

interface AnalyzeInput {
  headline: string;
  article: string;
}

function validate(input: unknown): AnalyzeInput {
  const i = input as Partial<AnalyzeInput>;
  if (!i || typeof i.headline !== "string" || typeof i.article !== "string") {
    throw new Error("Invalid input");
  }
  const headline = i.headline.trim().slice(0, 500);
  const article = i.article.trim().slice(0, 8000);
  if (headline.length < 3) throw new Error("Please enter a headline (at least 3 characters).");
  if (article.length < 20) throw new Error("Please paste at least 20 characters of article text.");
  return { headline, article };
}

/** Hugging Face fake-news classifier (free Inference API). */
async function hfClassify(text: string): Promise<{ label: string; score: number } | null> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) return null;
  // jy46604790/Fake-News-Bert-Detect → labels LABEL_0 (fake) / LABEL_1 (real)
  const model = "jy46604790/Fake-News-Bert-Detect";
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text.slice(0, 1500), options: { wait_for_model: true } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<Array<{ label: string; score: number }>> | Array<{ label: string; score: number }>;
    const arr = Array.isArray(data[0]) ? (data[0] as Array<{ label: string; score: number }>) : (data as Array<{ label: string; score: number }>);
    const best = arr.sort((a, b) => b.score - a.score)[0];
    return best ?? null;
  } catch {
    return null;
  }
}

/** Cross-check via HF zero-shot NLI. */
async function hfZeroShot(text: string): Promise<{ label: string; score: number } | null> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) return null;
  const model = "facebook/bart-large-mnli";
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: text.slice(0, 1500),
        parameters: { candidate_labels: ["factual reporting", "misinformation", "satire", "opinion"] },
        options: { wait_for_model: true },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { labels?: string[]; scores?: number[] };
    if (!data.labels?.length) return null;
    return { label: data.labels[0], score: data.scores?.[0] ?? 0 };
  } catch {
    return null;
  }
}

function languageStyleScore(text: string): number {
  let s = 70;
  const exclam = (text.match(/!/g) ?? []).length;
  const allCaps = (text.match(/\b[A-Z]{4,}\b/g) ?? []).length;
  const sensational = (text.match(/\b(shocking|unbelievable|you won't believe|destroyed|exposed|secret|miracle)\b/gi) ?? []).length;
  s -= Math.min(25, exclam * 3);
  s -= Math.min(20, allCaps * 4);
  s -= Math.min(30, sensational * 8);
  return Math.max(0, Math.min(100, s));
}

function sourceQualityScore(evidence: Evidence[]): number {
  if (!evidence.length) return 30;
  const trusted = ["wikipedia.org", "reuters.com", "apnews.com", "bbc.", "nytimes.com", "theguardian.com", "nature.com"];
  const hits = evidence.filter((e) => trusted.some((d) => e.url.includes(d))).length;
  return Math.min(100, 40 + (hits / evidence.length) * 60);
}

interface FusionInput {
  classifier: { label: string; score: number } | null;
  zeroShot: { label: string; score: number } | null;
  evidence: Evidence[];
  article: string;
}

function fuse({ classifier, zeroShot, evidence, article }: FusionInput): {
  verdict: Verdict;
  confidence: number;
  signals: TrustSignals;
  reasoning: string[];
} {
  const reasoning: string[] = [];

  // Map classifier
  let classifierVote: "real" | "fake" | null = null;
  let classifierConf = 0;
  if (classifier) {
    const fake = classifier.label === "LABEL_0" || /fake/i.test(classifier.label);
    classifierVote = fake ? "fake" : "real";
    classifierConf = classifier.score * 100;
    reasoning.push(
      `Primary classifier predicts ${classifierVote.toUpperCase()} with ${classifierConf.toFixed(0)}% confidence.`
    );
  } else {
    reasoning.push("Primary classifier unavailable — proceeding with retrieval signals only.");
  }

  // Map zero-shot
  let zsVote: "real" | "fake" | "mixed" | null = null;
  let zsConf = 0;
  if (zeroShot) {
    zsConf = zeroShot.score * 100;
    if (zeroShot.label === "factual reporting") zsVote = "real";
    else if (zeroShot.label === "misinformation") zsVote = "fake";
    else zsVote = "mixed";
    reasoning.push(`Cross-check NLI labels content as "${zeroShot.label}" (${zsConf.toFixed(0)}%).`);
  }

  const supports = evidence.filter((e) => e.support === "supports").length;
  const contradicts = evidence.filter((e) => e.support === "contradicts").length;
  const retrievalStrength = Math.min(100, evidence.length * 12 + supports * 8);
  reasoning.push(
    `Retrieved ${evidence.length} evidence item(s): ${supports} supporting, ${contradicts} contradicting.`
  );

  // Agreement between two models
  const consistency =
    classifierVote && zsVote
      ? classifierVote === zsVote
        ? 90
        : zsVote === "mixed"
          ? 55
          : 25
      : 50;

  // Combine
  let realScore = 0;
  let fakeScore = 0;
  if (classifierVote === "real") realScore += classifierConf;
  if (classifierVote === "fake") fakeScore += classifierConf;
  if (zsVote === "real") realScore += zsConf * 0.7;
  if (zsVote === "fake") fakeScore += zsConf * 0.7;
  realScore += supports * 10;
  fakeScore += contradicts * 12;

  let verdict: Verdict;
  let confidence: number;

  if (evidence.length === 0 && !classifier && !zeroShot) {
    verdict = "Unverified";
    confidence = 20;
    reasoning.push("Insufficient signals to render a verdict.");
  } else if (Math.abs(realScore - fakeScore) < 15) {
    verdict = "Mixed";
    confidence = 50 + Math.min(20, evidence.length * 2);
    reasoning.push("Signals conflict — verdict marked as Mixed.");
  } else if (realScore > fakeScore) {
    verdict = "Real";
    confidence = Math.min(95, 50 + (realScore - fakeScore) * 0.4);
  } else {
    verdict = "Fake";
    confidence = Math.min(95, 50 + (fakeScore - realScore) * 0.4);
  }

  // Penalize low retrieval
  if (retrievalStrength < 20) {
    confidence = Math.min(confidence, 60);
    reasoning.push("Low retrieval coverage — confidence capped.");
  }

  const signals: TrustSignals = {
    language_style: languageStyleScore(article),
    source_quality: sourceQualityScore(evidence),
    claim_consistency: consistency,
    retrieval_strength: retrievalStrength,
  };

  return { verdict, confidence: Math.round(confidence), signals, reasoning };
}

export const analyzeNews = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => validate(input))
  .handler(async ({ data }): Promise<VerdictResult> => {
    const { headline, article } = data;
    const fullText = `${headline}. ${article}`;

    const claims = extractClaims(article);
    const query = buildSearchQuery(headline, claims);

    const [classifier, zeroShot, wiki, ddg] = await Promise.all([
      hfClassify(fullText),
      hfZeroShot(fullText),
      searchWikipedia(query),
      searchDuckDuckGo(query),
    ]);

    const evidence = tagEvidence([...wiki, ...ddg].slice(0, 8), claims);
    const { verdict, confidence, signals, reasoning } = fuse({
      classifier,
      zeroShot,
      evidence,
      article,
    });

    const summary =
      verdict === "Real"
        ? "Content appears consistent with reliable reporting and retrieved evidence."
        : verdict === "Fake"
          ? "Content shows characteristics of misinformation or contradicts available evidence."
          : verdict === "Mixed"
            ? "Signals are mixed — parts of the content may be accurate while others are questionable."
            : "Insufficient evidence to determine credibility with confidence.";

    return {
      id: crypto.randomUUID(),
      verdict,
      confidence,
      summary,
      reasoning,
      evidence,
      signals,
      claims,
      headline,
      createdAt: Date.now(),
    };
  });
