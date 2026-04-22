import { useState } from "react";
import { Loader2, Sparkles, Link2, FileText, Download } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchArticle } from "@/server/fetch-article";

interface Props {
  loading: boolean;
  onSubmit: (headline: string, article: string) => void;
}

const SAMPLES = [
  {
    headline: "Scientists confirm water discovered on Mars surface",
    article:
      "NASA researchers announced today that data from the Perseverance rover indicates the presence of liquid water beneath the Martian surface. The findings, published in a peer-reviewed journal, suggest that subsurface aquifers may exist in the planet's mid-latitude regions.",
  },
  {
    headline: "SHOCKING: Drinking lemon water cures all diseases overnight!!!",
    article:
      "Doctors HATE this one weird trick! A miracle discovery proves that drinking lemon water can cure cancer, diabetes, and heart disease in just 24 hours. Big Pharma is hiding the truth from you. Share before they delete this!",
  },
];

export function AnalyzeForm({ loading, onSubmit }: Props) {
  const [headline, setHeadline] = useState("");
  const [article, setArticle] = useState("");
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [tab, setTab] = useState<"text" | "url">("text");
  const fetchFn = useServerFn(fetchArticle);

  async function handleFetch() {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const r = await fetchFn({ data: { url: url.trim() } });
      setHeadline(r.headline);
      setArticle(r.article);
      setTab("text");
      toast.success("Article extracted — review and run verification.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch article");
    } finally {
      setFetching(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(headline.trim(), article.trim());
      }}
      className="space-y-5 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-card backdrop-blur-xl md:p-8"
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as "text" | "url")}>
        <TabsList className="grid w-full grid-cols-2 bg-secondary/40">
          <TabsTrigger value="text" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <FileText className="h-3.5 w-3.5" />
            Paste text
          </TabsTrigger>
          <TabsTrigger value="url" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Link2 className="h-3.5 w-3.5" />
            From URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="mt-4 space-y-3">
          <Label htmlFor="url" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Article URL
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.bbc.com/news/…"
              className="h-12 flex-1 border-border/60 bg-background/40 text-base"
            />
            <Button
              type="button"
              onClick={handleFetch}
              disabled={fetching || !url.trim()}
              className="h-12 bg-secondary text-foreground hover:bg-secondary/80"
            >
              {fetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Extract
                </>
              )}
            </Button>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            We fetch the page server-side, strip ads/nav, and extract the headline + body.
          </p>
        </TabsContent>

        <TabsContent value="text" className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="headline" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              01 · Headline
            </Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Paste the news headline…"
              maxLength={500}
              required
              minLength={3}
              className="h-12 border-border/60 bg-background/40 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="article" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              02 · Article body
            </Label>
            <Textarea
              id="article"
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder="Paste the full article text (min 20 chars)…"
              maxLength={8000}
              required
              minLength={20}
              rows={9}
              className="resize-y border-border/60 bg-background/40 font-mono text-sm leading-relaxed"
            />
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Min 20 · Max 8,000 chars</span>
              <span>{article.length.toLocaleString()} / 8,000</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Try sample:
          </span>
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setHeadline(s.headline);
                setArticle(s.article);
                setTab("text");
              }}
              className="rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              {i === 0 ? "Real" : "Suspicious"}
            </button>
          ))}
        </div>
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="group relative bg-gradient-to-r from-primary via-primary-glow to-accent font-semibold text-primary-foreground shadow-glow hover:opacity-95 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Run Verification
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
