import type { EnricherContext } from "./types.js";

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export async function generateEmbedding(
  text: string,
  ctx: EnricherContext,
): Promise<number[] | null> {
  if (!ctx.env.OPENAI_API_KEY) {
    ctx.logger.debug("OPENAI_API_KEY not set, skipping embedding generation");
    return null;
  }

  // Truncate to ~8k chars (model supports 8191 tokens, ~4 chars per token)
  const truncated = text.length > 8000 ? text.slice(0, 8000) : text;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncated,
    }),
  });

  if (!res.ok) {
    ctx.logger.warn({ status: res.status }, "OpenAI embedding request failed");
    return null;
  }

  const body = (await res.json()) as OpenAIEmbeddingResponse;
  return body.data[0]?.embedding ?? null;
}
