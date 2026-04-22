import { createServerFn } from "@tanstack/react-start";
import type { Evidence, TrustSignals, Verdict, VerdictResult } from "@/lib/types";
import {
  buildSearchQuery,
  extractClaims,
  searchDuckDuckGo,
  searchWikipedia,
  tagEvidence,
} from "@/lib/retrieval";
import { languageStyleScore, sourceQualityScore } from "@/lib/scoring";
import { llmJudge, type JudgeOutput } from "@/lib/llm-judge";

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

/** Hugging Face fake-news classifier. */
async function hfClassify(text: string): Promise<{ label: string; score: number } | null> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) return null;
  const model = "jy46604790/Fake-News-Bert-Detect";
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text.slice(0, 1500), options: { wait_for_model: true } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as
      | Array<Array<{ label: string; score: number }>>
      | Array<{ label: string; score: number }>;
    const arr = Array.isArray(data[0])
      ? (data[0] as Array<{ label: string; score: number }>)
      : (data as Array<{ label: string; score: number }>);
    const best = arr.sort((a, b) => b.score - a.score)[0];
    return best ?? null;
  } catch {
    return null;
  }
}

interface FusionInput {
  classifier: { label: string; score: number } | null;
  judge: JudgeOutput | null;
  evidence: Evidence[];
  article: string;
}

function fuse({ classifier, judge, evidence, article }: FusionInput): {
  verdict: Verdict;
  confidence: number;
  signals: TrustSignals;
  reasoning: string[];
} {
  const reasoning: string[] = [];

  // Classifier vote
  let classifierVote: "real" | "fake" | null = null;
  let classifierConf = 0;
  if (classifier) {
    const fake = classifier.label === "LABEL_0" || /fake/i.test(classifier.label);
    classifierVote = fake ? "fake" : "real";
    classifierConf = classifier.score * 100;
    reasoning.push(
      `BERT classifier predicts ${classifierVote.toUpperCase()} (${classifierConf.toFixed(0)}% raw).`
    );
  }

  // Evidence stats
  const supports = evidence.filter((e) => e.support === "supports").length;
  const contradicts = evidence.filter((e) => e.support === "contradicts").length;
  const retrievalStrength = Math.min(100, evidence.length * 11 + supports * 9);
  reasoning.push(
    `Retrieved ${evidence.length} source(s): ${supports} supporting, ${contradicts} contradicting.`
  );

  // LLM judge — primary signal when available
  let verdict: Verdict;
  let confidence: number;

  if (judge) {
    verdict = judge.verdict;
    confidence = judge.confidence;
    reasoning.push(`AI judge: ${judge.reasoning}`);

    // Boost confidence when supporting evidence is strong (judge tends to be conservative)
    if ((verdict === "Real" || verdict === "Fake") && supports >= 2 && contradicts === 0) {
      confidence = Math.min(95, confidence + 8);
      reasoning.push("Multiple supporting sources, no contradictions — confidence boosted.");
    }
    if (verdict === "Real" && supports >= 1 && contradicts === 0 && evidence.length >= 3) {
      confidence = Math.min(94, confidence + 5);
    }

    // Cross-check with classifier — boost or penalize
    if (classifierVote) {
      const judgeBinary = verdict === "Real" ? "real" : verdict === "Fake" ? "fake" : null;
      if (judgeBinary && judgeBinary === classifierVote) {
        confidence = Math.min(97, confidence + 8);
        reasoning.push("Classifier agrees with AI judge — confidence boosted.");
      } else if (judgeBinary && judgeBinary !== classifierVote) {
        // Only penalize if classifier is highly confident; BERT classifier is noisy
        if (classifierConf > 80) {
          confidence = Math.max(50, confidence - 8);
          reasoning.push("High-confidence classifier disagrees — confidence slightly reduced.");
        } else {
          reasoning.push("Low-confidence classifier disagrees — ignored.");
        }
      }
    }

    // Reward journalistic style for Real verdicts
    const style = languageStyleScore(article);
    if (verdict === "Real" && style > 75) {
      confidence = Math.min(96, confidence + 4);
    }
  } else {
    // Fallback: classifier + evidence only
    let realScore = 0;
    let fakeScore = 0;
    if (classifierVote === "real") realScore += classifierConf;
    if (classifierVote === "fake") fakeScore += classifierConf;
    realScore += supports * 12;
    fakeScore += contradicts * 14;
    // Style penalty
    const style = languageStyleScore(article);
    if (style < 50) fakeScore += (50 - style) * 0.6;
    if (style > 75) realScore += (style - 75) * 0.4;

    if (!classifier && evidence.length === 0) {
      verdict = "Unverified";
      confidence = 22;
      reasoning.push("No AI judge, no classifier, no evidence — verdict deferred.");
    } else if (Math.abs(realScore - fakeScore) < 12) {
      verdict = "Mixed";
      confidence = 50 + Math.min(18, evidence.length * 2);
      reasoning.push("Signals conflict — falling back to Mixed.");
    } else if (realScore > fakeScore) {
      verdict = "Real";
      confidence = Math.min(85, 50 + (realScore - fakeScore) * 0.4);
    } else {
      verdict = "Fake";
      confidence = Math.min(85, 50 + (fakeScore - realScore) * 0.4);
    }
  }

  // Penalize ONLY when retrieval is weak AND no supporting evidence found
  if (retrievalStrength < 18 && supports === 0 && verdict !== "Unverified") {
    confidence = Math.min(confidence, 72);
    reasoning.push("Limited evidence coverage — confidence capped at 72%.");
  }

  // Consistency between models
  const consistency =
    classifierVote && judge
      ? (verdict === "Real" && classifierVote === "real") ||
        (verdict === "Fake" && classifierVote === "fake")
        ? 92
        : verdict === "Mixed" || verdict === "Unverified"
          ? 60
          : 28
      : judge
        ? 70
        : 50;

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

    // 1) Retrieve evidence + run BERT classifier in parallel
    const [classifier, wiki, ddg] = await Promise.all([
      hfClassify(fullText),
      searchWikipedia(query),
      searchDuckDuckGo(query),
    ]);

    const evidence = tagEvidence([...wiki, ...ddg].slice(0, 10), claims);

    // 2) AI judge synthesizes everything (depends on evidence — runs after)
    const judge = await llmJudge({ headline, article, claims, evidence });

    const { verdict, confidence, signals, reasoning } = fuse({
      classifier,
      judge,
      evidence,
      article,
    });

    const summary =
      verdict === "Real"
        ? "Content appears consistent with reliable reporting and retrieved evidence."
        : verdict === "Fake"
          ? "Content shows characteristics of misinformation or contradicts available evidence."
          : verdict === "Mixed"
            ? "Signals are mixed — parts may be accurate while others are questionable."
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
