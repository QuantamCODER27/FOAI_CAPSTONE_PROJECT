import { createServerFn } from "@tanstack/react-start";
import type { Verdict, VerdictResult } from "@/lib/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RevisedVerdict {
  verdict: Verdict;
  confidence: number;
  summary: string;
  changeNote: string;
}

export interface ChatResponse {
  reply: string;
  revised: RevisedVerdict | null;
}

interface ChatInput {
  result: VerdictResult;
  messages: ChatMessage[];
}

function validate(input: unknown): ChatInput {
  const i = input as Partial<ChatInput>;
  if (!i || !i.result || !Array.isArray(i.messages)) {
    throw new Error("Invalid chat input");
  }
  return { result: i.result as VerdictResult, messages: i.messages as ChatMessage[] };
}

export const chatAboutVerdict = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => validate(input))
  .handler(async ({ data }): Promise<ChatResponse> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway not configured");

    const { result, messages } = data;

    const evidenceBlock = result.evidence
      .slice(0, 8)
      .map(
        (e, i) =>
          `[${i + 1}] (${e.support}) ${e.source}\n${e.snippet}\nURL: ${e.url}`,
      )
      .join("\n\n") || "No external evidence retrieved.";

    const systemPrompt = `You are a fact-checking assistant helping a user discuss a news article that was already analyzed.

CURRENT VERDICT: ${result.verdict} (${result.confidence}% confidence)
HEADLINE: ${result.headline}
SUMMARY: ${result.summary}

EXTRACTED CLAIMS:
${result.claims.map((c, i) => `${i + 1}. ${c}`).join("\n") || "None"}

RETRIEVED EVIDENCE:
${evidenceBlock}

ORIGINAL REASONING:
${result.reasoning.join("\n- ")}

Your job:
- Engage thoughtfully with the user's counter-arguments, new sources, or corrections.
- If the user provides a credible URL, specific source, named expert, or compelling factual correction that genuinely changes the picture, call the "revise_verdict" tool to update the verdict and confidence.
- Do NOT revise the verdict for vague disagreement, opinions, emotional appeals, or unsupported claims. Push back politely and ask for sources.
- When revising: be calibrated. A strong contradicting source from a credible outlet should shift confidence meaningfully. A single anecdote should not flip a verdict.
- Always reply conversationally in the "content" field. If you also revise, briefly explain WHY in the changeNote.
- Keep replies concise (2-4 sentences usually).`;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        tools: [
          {
            type: "function",
            function: {
              name: "revise_verdict",
              description:
                "Update the verdict ONLY if the user provided a substantive new source or correction.",
              parameters: {
                type: "object",
                properties: {
                  verdict: {
                    type: "string",
                    enum: ["Real", "Fake", "Mixed", "Unverified"],
                  },
                  confidence: { type: "number", description: "0-100 calibrated confidence." },
                  summary: { type: "string", description: "New 1-sentence summary." },
                  changeNote: {
                    type: "string",
                    description: "1-2 sentences citing what the user contributed.",
                  },
                },
                required: ["verdict", "confidence", "summary", "changeNote"],
                additionalProperties: false,
              },
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit exceeded. Please wait a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add funds in workspace settings.");
      throw new Error(`AI gateway error (${res.status})`);
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };

    const msg = json.choices?.[0]?.message;
    let reply = msg?.content?.trim() || "";
    let revised: RevisedVerdict | null = null;

    const toolCall = msg?.tool_calls?.find((t) => t.function?.name === "revise_verdict");
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments) as RevisedVerdict;
        parsed.confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence)));
        revised = parsed;
        if (!reply) {
          reply = `I've updated the verdict to ${parsed.verdict} (${parsed.confidence}%). ${parsed.changeNote}`;
        }
      } catch {
        // ignore
      }
    }

    if (!reply) reply = "I'm not sure how to respond to that — could you rephrase or share a source?";

    return { reply, revised };
  });
