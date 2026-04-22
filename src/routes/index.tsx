import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AnalyzeForm } from "@/components/analyze-form";
import { ResultsView } from "@/components/results-view";
import { analyzeNews } from "@/server/analyze";
import { saveToHistory } from "@/lib/history";
import type { VerdictResult } from "@/lib/types";
import { Toaster } from "@/components/ui/sonner";
import { ScanLine } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const analyze = useServerFn(analyzeNews);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerdictResult | null>(null);

  async function onSubmit(headline: string, article: string) {
    setLoading(true);
    setResult(null);
    try {
      const r = await analyze({ data: { headline, article } });
      setResult(r);
      saveToHistory(r);
      toast.success(`Verdict: ${r.verdict} · ${r.confidence}% confidence`);
      // Scroll to results
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative">
      <Toaster theme="dark" position="top-right" />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              <ScanLine className="h-3 w-3" />
              Multi-Model Verification Engine
            </div>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Detect <span className="text-gradient">fake news</span>
              <br /> with explainable AI.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Paste a headline and article. We run two AI models, retrieve real-world evidence from
              Wikipedia and DuckDuckGo, and return a transparent verdict with sources you can verify.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <AnalyzeForm loading={loading} onSubmit={onSubmit} />
          </div>
        </div>
      </section>

      {/* Results */}
      <section id="results" className="mx-auto max-w-6xl px-6 py-12">
        {loading && <LoadingState />}
        {!loading && result && (
          <div className="mx-auto max-w-4xl">
            <ResultsView result={result} />
          </div>
        )}
        {!loading && !result && <FeatureGrid />}
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card/40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-border/60 bg-card/40" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl border border-border/60 bg-card/40" />
      <p className="text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Running classifier · zero-shot NLI · Wikipedia · DuckDuckGo…
      </p>
    </div>
  );
}

function FeatureGrid() {
  const items = [
    { n: "01", t: "Claim extraction", d: "Identifies the strongest factual claims in the article." },
    { n: "02", t: "Dual classification", d: "Fake-news transformer + zero-shot NLI cross-check." },
    { n: "03", t: "Real evidence", d: "Wikipedia + DuckDuckGo — never fabricated citations." },
    { n: "04", t: "Verdict fusion", d: "Combines model agreement and source overlap into one score." },
  ];
  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.n}
          className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm transition-all hover:border-primary/40"
        >
          <div className="font-mono text-xs text-primary">{it.n}</div>
          <div className="mt-2 font-semibold">{it.t}</div>
          <p className="mt-1 text-sm text-muted-foreground">{it.d}</p>
        </div>
      ))}
    </div>
  );
}
