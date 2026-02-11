import Anthropic from "@anthropic-ai/sdk";
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
  if (!ctx.env.ANTHROPIC_API_KEY) {
    ctx.logger.debug("ANTHROPIC_API_KEY not set, skipping LLM enrichment");
    return null;
  }

  const client = new Anthropic({ apiKey: ctx.env.ANTHROPIC_API_KEY });

  // Truncate content to ~4k chars to keep costs low with Haiku
  const truncated = content.length > 4000 ? content.slice(0, 4000) + "..." : content;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: truncated }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  // Strip markdown code fences if present (Haiku sometimes wraps in ```json ... ```)
  const text = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

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
