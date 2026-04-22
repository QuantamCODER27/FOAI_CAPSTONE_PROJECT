import type { VerdictResult, Verdict } from "@/lib/types";
import { ExternalLink, AlertTriangle, CheckCircle2, HelpCircle, Scale } from "lucide-react";

const verdictMeta: Record<
  Verdict,
  { label: string; color: string; bg: string; ring: string; icon: typeof CheckCircle2 }
> = {
  Real: {
    label: "Likely Real",
    color: "text-success",
    bg: "bg-success/10",
    ring: "ring-success/40",
    icon: CheckCircle2,
  },
  Fake: {
    label: "Likely Fake",
    color: "text-destructive",
    bg: "bg-destructive/10",
    ring: "ring-destructive/40",
    icon: AlertTriangle,
  },
  Mixed: {
    label: "Mixed Signals",
    color: "text-warning",
    bg: "bg-warning/10",
    ring: "ring-warning/40",
    icon: Scale,
  },
  Unverified: {
    label: "Unverified",
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    ring: "ring-border",
    icon: HelpCircle,
  },
};

export function ResultsView({ result }: { result: VerdictResult }) {
  const meta = verdictMeta[result.verdict];
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      {/* Verdict card */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm md:p-8 ${meta.ring} ring-1`}
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${meta.bg}`}>
              <Icon className={`h-7 w-7 ${meta.color}`} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Verdict
              </div>
              <div className={`text-3xl font-bold tracking-tight md:text-4xl ${meta.color}`}>
                {meta.label}
              </div>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{result.summary}</p>
            </div>
          </div>
          <ConfidenceRing value={result.confidence} />
        </div>
      </div>

      {/* Signals */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SignalBar label="Language" value={result.signals.language_style} />
        <SignalBar label="Sources" value={result.signals.source_quality} />
        <SignalBar label="Consistency" value={result.signals.claim_consistency} />
        <SignalBar label="Retrieval" value={result.signals.retrieval_strength} />
      </div>

      {/* Reasoning */}
      <Section title="Reasoning">
        <ul className="space-y-2.5">
          {result.reasoning.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-foreground/90">{r}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Claims */}
      {result.claims.length > 0 && (
        <Section title="Extracted Claims">
          <ul className="space-y-2 font-mono text-xs leading-relaxed text-muted-foreground">
            {result.claims.map((c, i) => (
              <li key={i} className="rounded-md border border-border/40 bg-background/40 p-3">
                <span className="mr-2 text-primary">{String(i + 1).padStart(2, "0")}</span>
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Evidence */}
      <Section title={`Evidence · ${result.evidence.length}`}>
        {result.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence retrieved from public sources.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {result.evidence.map((e, i) => (
              <a
                key={i}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-border/60 bg-background/40 p-4 transition-all hover:border-primary/60 hover:bg-background/60"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-foreground">{e.source}</span>
                  <SupportBadge support={e.support} />
                </div>
                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{e.snippet}</p>
                <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open source <ExternalLink className="h-3 w-3" />
                </div>
              </a>
            ))}
          </div>
        )}
      </Section>

      <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">AI disclaimer:</strong> NewsVerdict combines machine
        learning models and public retrieval to estimate credibility. Results are probabilistic and
        should not replace human editorial judgment. Always verify claims with primary sources.
      </div>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/40" />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke="url(#grad)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.18 195)" />
            <stop offset="100%" stopColor="oklch(0.72 0.24 330)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold">{value}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">conf %</span>
      </div>
    </div>
  );
}

function SignalBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-sm">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SupportBadge({ support }: { support: "supports" | "contradicts" | "neutral" }) {
  const map = {
    supports: { label: "supports", cls: "bg-success/15 text-success" },
    contradicts: { label: "contradicts", cls: "bg-destructive/15 text-destructive" },
    neutral: { label: "neutral", cls: "bg-muted/40 text-muted-foreground" },
  } as const;
  const m = map[support];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}
