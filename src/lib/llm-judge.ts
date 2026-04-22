import type { Evidence } from "./types";

export interface JudgeOutput {
  verdict: "Real" | "Fake" | "Mixed" | "Unverified";
  confidence: number; // 0-100
  reasoning: string;
}

/**
 * Lovable AI Gateway as a calibrated reasoning judge.
 * Uses tool calling for structured output — far more reliable than asking for JSON.
 */
export async function llmJudge(args: {
  headline: string;
  article: string;
  claims: string[];
  evidence: Evidence[];
}): Promise<JudgeOutput | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;

  const evidenceBlock = args.evidence.length
    ? args.evidence
        .slice(0, 8)
        .map((e, i) => `[${i + 1}] (${e.support}) ${e.source}\n${e.snippet}\nURL: ${e.url}`)
        .join("\n\n")
    : "No external evidence retrieved.";

  const claimsBlock = args.claims.length
    ? args.claims.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : "No discrete claims extracted.";

  const systemPrompt = `You are a calibrated fact-checking analyst for a news verification platform.
You will be given a headline, article body, extracted claims, and retrieved evidence from Wikipedia and DuckDuckGo.
Your job: render a confident, well-calibrated verdict.

Verdict rules:
- "Real": claims align with evidence OR the writing is clearly journalistic (neutral tone, attributed sources, no sensationalism) and nothing in the evidence contradicts it. Real, well-written news from credible-sounding sources should be marked Real with HIGH confidence (80-92), even when evidence retrieval is partial — absence of contradicting evidence for plausible journalistic content is itself a positive signal.
- "Fake": claims contradict evidence, contain known misinformation patterns, or use clickbait/sensational style ("SHOCKING", "miracle cure", "Big Pharma", excessive !!!) with no credible support. Mark with high confidence (80-92) when signals are clear.
- "Mixed": some claims supported, others questionable or unsupported. Use this only when there is genuine internal conflict.
- "Unverified": ONLY when the article is too vague or short to evaluate AND there is no style signal either way. Do NOT default to Unverified just because evidence retrieval returned few results.

Confidence calibration:
- Be DECISIVE when signals are clear. Real journalistic content with no contradictions = 82-92.
- Clear misinformation patterns = 82-92.
- Use 65-78 only when signals are genuinely mixed.
- Reserve <60 for truly ambiguous cases.
- Cap at 95 unless evidence is unambiguous and multiple sources directly support the claims.`;

  const userPrompt = `HEADLINE: ${args.headline}

ARTICLE:
${args.article.slice(0, 3500)}

EXTRACTED CLAIMS:
${claimsBlock}

RETRIEVED EVIDENCE:
${evidenceBlock}

Render your verdict via the report_verdict tool.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_verdict",
              description: "Submit the final fact-check verdict.",
              parameters: {
                type: "object",
                properties: {
                  verdict: {
                    type: "string",
                    enum: ["Real", "Fake", "Mixed", "Unverified"],
                    description: "Final classification.",
                  },
                  confidence: {
                    type: "number",
                    description: "Calibrated confidence 0-100.",
                  },
                  reasoning: {
                    type: "string",
                    description: "2-4 sentence explanation citing evidence numbers like [1], [2].",
                  },
                },
                required: ["verdict", "confidence", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_verdict" } },
      }),
    });

    if (!res.ok) {
      console.error("LLM judge error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };
    const argsStr = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) return null;
    const parsed = JSON.parse(argsStr) as JudgeOutput;
    parsed.confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence)));
    return parsed;
  } catch (err) {
    console.error("LLM judge exception", err);
    return null;
  }
}
