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

  const systemPrompt = `You are a meticulous fact-checking analyst for a news verification platform.
You will be given a headline, article body, extracted claims, and retrieved evidence from Wikipedia and DuckDuckGo.
Your job: render a calibrated verdict.

Rules:
- "Real": claims align with evidence and writing style is journalistic.
- "Fake": claims contradict evidence, contain known misinformation patterns, or use clickbait/sensational style with no support.
- "Mixed": some claims supported, others questionable or unsupported.
- "Unverified": insufficient evidence AND no strong signals either way.
- Be conservative: do NOT mark "Real" or "Fake" with confidence > 85 unless evidence is unambiguous.
- Cap confidence at 70 when evidence is empty.
- Account for sensational language (LOTS OF CAPS, !!!, "miracle cure", "Big Pharma") as a fake signal.`;

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
