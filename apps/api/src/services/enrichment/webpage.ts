import type { EnrichmentResult, EnricherContext } from "./types.js";

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      ogImage?: string;
    };
  };
}

export async function enrichWebpage(
  url: string,
  ctx: EnricherContext,
): Promise<EnrichmentResult> {
  if (!ctx.env.FIRECRAWL_API_KEY) {
    ctx.logger.debug("FIRECRAWL_API_KEY not set, skipping webpage enrichment");
    return { sourceType: "webpage" };
  }

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
    }),
  });

  if (!res.ok) {
    ctx.logger.warn({ status: res.status, url }, "Firecrawl scrape failed");
    return { sourceType: "webpage" };
  }

  const body = (await res.json()) as FirecrawlScrapeResponse;
  if (!body.success || !body.data) {
    ctx.logger.warn({ url }, "Firecrawl returned unsuccessful response");
    return { sourceType: "webpage" };
  }

  return {
    title: body.data.metadata?.title,
    description: body.data.metadata?.description,
    imageUrl: body.data.metadata?.ogImage,
    rawContent: body.data.markdown,
    sourceType: "webpage",
  };
}
