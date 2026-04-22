import { createServerFn } from "@tanstack/react-start";

interface FetchInput {
  url: string;
}

function validate(input: unknown): FetchInput {
  const i = input as Partial<FetchInput>;
  if (!i || typeof i.url !== "string") throw new Error("Invalid input");
  const url = i.url.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("URL must start with http:// or https://");
  try {
    new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }
  return { url };
}

/** Strip HTML tags & decode common entities into clean plain text. */
function stripHtml(html: string): string {
  // Remove script/style blocks entirely
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Replace block tags with newlines so paragraphs survive
  s = s.replace(/<\/(p|div|section|article|h[1-6]|li|br)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, " ");
  // Decode common entities
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&[a-z0-9#]+;/gi, " ");
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n\n").trim();
  return s;
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return og[1].trim();
  const tw = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
  if (tw?.[1]) return tw[1].trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripHtml(h1[1]).slice(0, 300);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t?.[1]) return stripHtml(t[1]).slice(0, 300);
  return "";
}

function extractArticle(html: string): string {
  // Prefer <article>
  const art = html.match(/<article[\s\S]*?<\/article>/i);
  if (art) {
    const txt = stripHtml(art[0]);
    if (txt.length > 200) return txt;
  }
  // Fallback: <main>
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  if (main) {
    const txt = stripHtml(main[0]);
    if (txt.length > 200) return txt;
  }
  // Fallback: collect paragraphs
  const paras = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => stripHtml(m[1]))
    .filter((p) => p.length > 40);
  if (paras.length) return paras.join("\n\n");
  return stripHtml(html);
}

export const fetchArticle = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => validate(input))
  .handler(async ({ data }): Promise<{ headline: string; article: string }> => {
    const res = await fetch(data.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NewsVerdictBot/1.0; +https://newsverdict.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Failed to fetch URL (HTTP ${res.status})`);
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ct)) {
      throw new Error("URL did not return an HTML page.");
    }
    const html = (await res.text()).slice(0, 1_500_000);
    const headline = extractTitle(html);
    let article = extractArticle(html).slice(0, 8000);
    if (!headline || headline.length < 3) {
      throw new Error("Could not extract a headline from this page.");
    }
    if (article.length < 100) {
      throw new Error("Could not extract enough article text from this page.");
    }
    // Trim leading title duplicate
    if (article.toLowerCase().startsWith(headline.toLowerCase())) {
      article = article.slice(headline.length).trim();
    }
    return { headline, article };
  });
