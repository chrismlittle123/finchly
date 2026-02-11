import { LLMClient } from "../../lib/llm.js";
import type { LlmResult, EnricherContext } from "./types.js";

const TAG_TAXONOMY = [
  "ai-ml",
  "web-dev",
  "backend",
  "frontend",
  "devops",
  "security",
  "data",
  "mobile",
  "open-source",
  "product",
  "design",
  "career",
  "startup",
  "research",
  "tutorial",
  "tool",
  "opinion",
  "news",
] as const;

const SYSTEM_PROMPT = `You are a link categorizer. Given the content of a web page, tweet, or repository, provide:
1. A concise 1-2 sentence summary of what this content is about.
2. 1-3 tags from ONLY this fixed list: ${TAG_TAXONOMY.join(", ")}

Respond with valid JSON only, no markdown:
{"summary": "...", "tags": ["..."]}`;

export async function generateSummaryAndTags(
  content: string,
  ctx: EnricherContext,
): Promise<LlmResult | null> {
  if (!ctx.env.LLM_GATEWAY_URL) {
    ctx.logger.debug("LLM_GATEWAY_URL not set, skipping LLM enrichment");
    return null;
  }

  const client = new LLMClient({ baseUrl: ctx.env.LLM_GATEWAY_URL });

  // Truncate content to ~4k chars to keep costs low with Haiku
  const truncated = content.length > 4000 ? content.slice(0, 4000) + "..." : content;

  const completion = await client.complete({
    model: "claude-haiku-4-5-20251001",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: truncated },
    ],
    fallbacks: ["claude-3-5-haiku-latest"],
  });

  // Strip markdown code fences if present (Haiku sometimes wraps in ```json ... ```)
  const text = completion.content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(text) as { summary: string; tags: string[] };
    // Filter tags to only allow values from our taxonomy
    const validTags = parsed.tags.filter((t) =>
      (TAG_TAXONOMY as readonly string[]).includes(t),
    );
    return {
      summary: parsed.summary,
      tags: validTags,
    };
  } catch {
    ctx.logger.warn({ text }, "Failed to parse LLM response as JSON");
    return null;
  }
}
