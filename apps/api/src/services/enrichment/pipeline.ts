import { links, eq } from "@finchly/db";
import { detectSourceType, type SourceType } from "../../lib/source-type.js";
import { enrichGitHub } from "./github.js";
import { enrichX } from "./x.js";
import { enrichWebpage } from "./webpage.js";
import { generateSummaryAndTags } from "./llm.js";
import { generateEmbedding } from "./embedding.js";
import type { EnrichmentResult, EnricherContext } from "./types.js";

const MAX_DEPTH = 1;

async function fetchSourceContent(
  url: string,
  sourceType: SourceType,
  ctx: EnricherContext,
): Promise<EnrichmentResult> {
  try {
    switch (sourceType) {
      case "github": return await enrichGitHub(url, ctx);
      case "x": return await enrichX(url, ctx);
      default: return await enrichWebpage(url, ctx);
    }
  } catch (err) {
    ctx.logger.warn({ err, url, sourceType }, "Source enricher failed, falling back to webpage");
    try {
      return await enrichWebpage(url, ctx);
    } catch (fallbackErr) {
      ctx.logger.error({ err: fallbackErr, url }, "Webpage fallback also failed");
      return { sourceType };
    }
  }
}

async function insertExtractedUrls(
  urls: string[],
  ctx: EnricherContext,
  depth: number,
): Promise<void> {
  for (const extractedUrl of urls) {
    try {
      await ctx.db
        .insert(links)
        .values({ url: extractedUrl })
        .onConflictDoNothing({ target: [links.url, links.workspaceId] });

      enrichLink(extractedUrl, ctx, depth + 1).catch((err) => {
        ctx.logger.error({ err, url: extractedUrl }, "Extracted URL enrichment failed");
      });
    } catch (err) {
      ctx.logger.warn({ err, url: extractedUrl }, "Failed to insert extracted URL");
    }
  }
}

export async function enrichLink(
  url: string,
  ctx: EnricherContext,
  depth = 0,
): Promise<void> {
  const sourceType = detectSourceType(url);
  const result = await fetchSourceContent(url, sourceType, ctx);

  // LLM summary + tags
  let summary: string | undefined;
  let tags: string[] | undefined;
  const contentForLlm = result.rawContent ?? result.description ?? result.title;
  if (contentForLlm) {
    try {
      const llmResult = await generateSummaryAndTags(contentForLlm, ctx);
      if (llmResult) {
        summary = llmResult.summary;
        tags = llmResult.tags;
      }
    } catch (err) {
      ctx.logger.warn({ err, url }, "LLM enrichment failed");
    }
  }

  // Embedding
  let embedding: number[] | null = null;
  const textForEmbedding = [result.title, result.description, summary, result.rawContent]
    .filter(Boolean)
    .join("\n\n");
  if (textForEmbedding) {
    try {
      embedding = await generateEmbedding(textForEmbedding, ctx);
    } catch (err) {
      ctx.logger.warn({ err, url }, "Embedding generation failed");
    }
  }

  // Update the link in the database
  await ctx.db
    .update(links)
    .set({
      title: result.title ?? undefined,
      description: result.description ?? undefined,
      imageUrl: result.imageUrl ?? undefined,
      rawContent: result.rawContent ?? undefined,
      sourceType: result.sourceType,
      summary: summary ?? undefined,
      tags: tags ?? undefined,
      embedding: embedding ?? undefined,
      enrichedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(links.url, url));

  ctx.logger.info(
    {
      url,
      sourceType: result.sourceType,
      hasTitle: !!result.title,
      hasSummary: !!summary,
      hasTags: !!tags?.length,
      hasEmbedding: !!embedding,
    },
    "Link enriched",
  );

  // Insert extracted URLs (e.g. from tweets) as new links
  if (depth < MAX_DEPTH && result.extractedUrls && result.extractedUrls.length > 0) {
    await insertExtractedUrls(result.extractedUrls, ctx, depth);
  }
}
