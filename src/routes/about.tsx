import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "About · NewsVerdict" },
      { name: "description", content: "How NewsVerdict works — models, evidence, and limitations." },
    ],
  }),
});

function About() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Transparency
      </div>
      <h1 className="mt-1 text-4xl font-bold tracking-tight">How NewsVerdict works</h1>

      <div className="mt-10 space-y-8 text-foreground/90">
        <Section n="01" title="Claim extraction">
          We split your article into sentences and rank them by signals like proper nouns, numbers,
          and reporting verbs. The top claims drive retrieval queries.
        </Section>
        <Section n="02" title="Dual classification">
          We run two open Hugging Face models in parallel:
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li><span className="font-mono text-primary">jy46604790/Fake-News-Bert-Detect</span> — binary fake/real classifier</li>
            <li><span className="font-mono text-primary">facebook/bart-large-mnli</span> — zero-shot label across factual / misinformation / satire / opinion</li>
          </ul>
        </Section>
        <Section n="03" title="Real-world evidence">
          We query <strong>Wikipedia</strong> and <strong>DuckDuckGo</strong> Instant Answer with
          claim-derived queries. Snippets are tagged as supporting, contradicting, or neutral via
          lexical overlap and negation cues. <em>We never fabricate citations.</em>
        </Section>
        <Section n="04" title="Verdict fusion">
          Confidence is computed from classifier agreement, evidence count, and supporting / contradicting
          balance. When signals conflict we return <strong>Mixed</strong>. When evidence is sparse we
          cap confidence and may return <strong>Unverified</strong>.
        </Section>
        <Section n="05" title="Limitations">
          Models can be wrong, especially on breaking news, satire, and non-English content.
          Treat NewsVerdict as a research aid — always verify with primary sources before sharing.
        </Section>
      </div>
    </main>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-primary">{n}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="mt-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
