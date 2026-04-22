import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatAboutVerdict, type ChatMessage } from "@/server/chat";
import type { VerdictResult } from "@/lib/types";

export function VerdictChat({
  result,
  onVerdictRevised,
}: {
  result: VerdictResult;
  onVerdictRevised: (next: VerdictResult) => void;
}) {
  const chat = useServerFn(chatAboutVerdict);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await chat({ data: { result, messages: next } });
      setMessages([...next, { role: "assistant", content: r.reply }]);
      if (r.revised) {
        const updated: VerdictResult = {
          ...result,
          verdict: r.revised.verdict,
          confidence: r.revised.confidence,
          summary: r.revised.summary,
          reasoning: [...result.reasoning, `User dialogue: ${r.revised.changeNote}`],
        };
        onVerdictRevised(updated);
        toast.success(`Verdict updated → ${r.revised.verdict} · ${r.revised.confidence}%`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-card/60 p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          Counter the verdict · AI dialogue
        </h2>
        <span className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-accent md:inline-flex">
          <Sparkles className="h-3 w-3" /> Verdict can update
        </span>
      </div>

      <div
        ref={scrollRef}
        className="mb-4 max-h-80 min-h-32 space-y-3 overflow-y-auto rounded-xl border border-border/40 bg-background/30 p-4"
      >
        {messages.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Disagree with the verdict? Share a source, cite an expert, or point out a missed fact —
            the AI will reconsider and may revise the call.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 bg-card/80 text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="e.g. Reuters reported the opposite on Oct 3 — here's the link…"
          className="min-h-[52px] resize-none"
          disabled={loading}
        />
        <Button onClick={send} disabled={loading || !input.trim()} className="h-auto self-stretch px-4">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
