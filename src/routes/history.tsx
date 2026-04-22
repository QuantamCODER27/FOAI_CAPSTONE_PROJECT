import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clearHistory, getHistory } from "@/lib/history";
import { ResultsView } from "@/components/results-view";
import type { VerdictResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Trash2, History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [{ title: "History · NewsVerdict" }],
  }),
});

function HistoryPage() {
  const [items, setItems] = useState<VerdictResult[]>([]);
  const [active, setActive] = useState<VerdictResult | null>(null);

  useEffect(() => {
    const h = getHistory();
    setItems(h);
    setActive(h[0] ?? null);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Local archive
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">History</h1>
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearHistory();
              setItems([]);
              setActive(null);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-16 text-center">
          <HistoryIcon className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No analyses yet — run one from the home page.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-2">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setActive(it)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  active?.id === it.id
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/60 bg-card/40 hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    {it.verdict} · {it.confidence}%
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(it.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-foreground">{it.headline}</p>
              </button>
            ))}
          </aside>
          <div>{active && <ResultsView result={active} />}</div>
        </div>
      )}
    </main>
  );
}
