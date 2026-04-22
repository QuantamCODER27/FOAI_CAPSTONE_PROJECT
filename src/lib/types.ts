export type Verdict = "Real" | "Fake" | "Mixed" | "Unverified";

export interface Evidence {
  source: string;
  url: string;
  snippet: string;
  support: "supports" | "contradicts" | "neutral";
}

export interface TrustSignals {
  language_style: number;       // 0-100, higher = more neutral/journalistic
  source_quality: number;       // 0-100
  claim_consistency: number;    // 0-100, agreement between models
  retrieval_strength: number;   // 0-100, evidence coverage
}

export interface VerdictResult {
  id: string;
  verdict: Verdict;
  confidence: number;            // 0-100
  summary: string;
  reasoning: string[];
  evidence: Evidence[];
  signals: TrustSignals;
  claims: string[];
  createdAt: number;
  headline: string;
}
