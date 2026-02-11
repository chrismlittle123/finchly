import type { EnrichmentResult, EnricherContext } from "./types.js";

export interface OEmbedParsed {
  text: string;
  author: string;
  handle: string;
  links: string[];
  mediaLinks: string[];
}

/**
 * Parse the HTML returned by Twitter's oEmbed API.
 * Extracts tweet text, author, and categorizes links as external (t.co) or media (pic.twitter.com).
 */
export function parseOEmbedHtml(html: string): OEmbedParsed {
  // Extract <p ...>...</p> content (tweet body)
  const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const pContent = pMatch?.[1] ?? "";

  // Extract author: &mdash; Name (@handle)
  const authorMatch = html.match(/&mdash;\s*(.+?)\s*\(@(\w+)\)/);
  const author = authorMatch?.[1] ?? "";
  const handle = authorMatch?.[2] ?? "";

  // Extract all <a> hrefs from the <p> block
  const links: string[] = [];
  const mediaLinks: string[] = [];
  const aRegex = /<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/g;
  let match;
  while ((match = aRegex.exec(pContent)) !== null) {
    const href = match[1];
    const linkText = match[2];

    // Skip the date link (contains twitter.com/user/status)
    if (href.includes("twitter.com/") && href.includes("/status/")) continue;
    // Skip @mention links
    if (href.includes("twitter.com/") && !href.startsWith("https://t.co/")) continue;

    if (linkText.startsWith("pic.twitter.com/")) {
      mediaLinks.push(href);
    } else {
      links.push(href);
    }
  }

  // Strip HTML tags to get plain text, normalize whitespace
  const text = pContent
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<a[^>]*>([^<]*)<\/a>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();

  return { text, author, handle, links, mediaLinks };
}

/**
 * Resolve a t.co short URL to its final destination without following the redirect.
 * Returns the original URL on failure.
 */
async function resolveTcoUrl(tcoUrl: string): Promise<string> {
  try {
    const res = await fetch(tcoUrl, { redirect: "manual" });
    const location = res.headers.get("location");
    return location ?? tcoUrl;
  } catch {
    return tcoUrl;
  }
}

export async function enrichX(
  url: string,
  ctx: EnricherContext,
): Promise<EnrichmentResult> {
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;

  const res = await fetch(oembedUrl);
  if (!res.ok) {
    ctx.logger.warn({ status: res.status, url }, "Twitter oEmbed request failed");
    return { sourceType: "x" };
  }

  const data = (await res.json()) as { html: string; author_name: string; author_url: string };
  const parsed = parseOEmbedHtml(data.html);

  // Resolve t.co links in parallel
  const resolvedLinks = await Promise.all(
    parsed.links.map((link) => resolveTcoUrl(link)),
  );

  const tweetContent = [
    `@${parsed.handle}: ${parsed.text}`,
    resolvedLinks.length > 0 ? `\nLinks: ${resolvedLinks.join(", ")}` : "",
  ].join("");

  return {
    title: `${parsed.author} (@${parsed.handle})`,
    description: parsed.text,
    rawContent: tweetContent,
    sourceType: "x",
    extractedUrls: resolvedLinks.filter((u) => !u.includes("pic.twitter.com")),
  };
}
