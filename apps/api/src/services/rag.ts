import { links, desc, gt, and, eq, isNotNull, cosineDistance, sql } from "@finchly/db";
import type { Database } from "@finchly/db";
import type { FinchlyEnv } from "../config.js";
import type { FastifyBaseLogger } from "fastify";
import { generateEmbedding } from "./enrichment/embedding.js";
import { LLMClient } from "@chrismlittle123/llm-client";

interface AskQuestionOpts {
  db: Database;
  env: FinchlyEnv;
  logger: FastifyBaseLogger;
  workspaceId?: string;
}

interface AskQuestionResult {
  answer: string;
  sources: Array<{ id: string; url: string; title: string | null; similarity: number }>;
}

export async function askQuestion(question: string, opts: AskQuestionOpts): Promise<AskQuestionResult> {
  const { db, env, logger } = opts;

  const queryEmbedding = await generateEmbedding(question, { db, env, logger });
  if (!queryEmbedding) {
    return { answer: "Failed to generate query embedding.", sources: [] };
  }

  const similarity = sql<number>`1 - (${cosineDistance(links.embedding, queryEmbedding)})`;

  const conditions = [isNotNull(links.embedding), gt(similarity, 0.3)];
  if (opts.workspaceId) {
    conditions.push(eq(links.workspaceId, opts.workspaceId));
  }

  const results = await db
    .select({
      id: links.id,
      url: links.url,
      title: links.title,
      summary: links.summary,
      rawContent: links.rawContent,
      similarity,
    })
    .from(links)
    .where(and(...conditions))
    .orderBy((t) => desc(t.similarity))
    .limit(5);

  if (results.length === 0) {
    return { answer: "I don't have any relevant links to answer that question.", sources: [] };
  }

  const answer = await generateAnswer(question, results, env.LLM_GATEWAY_URL!);

  return {
    answer,
    sources: results.map((r) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      similarity: r.similarity,
    })),
  };
}

async function generateAnswer(
  question: string,
  results: Array<{ url: string; title: string | null; summary: string | null; rawContent: string | null }>,
  gatewayUrl: string,
): Promise<string> {
  const context = results
    .map((r, i) => {
      const content = r.rawContent ? r.rawContent.slice(0, 2000) : r.summary ?? "No content available";
      return `[${i + 1}] ${r.title ?? r.url}\nURL: ${r.url}\n${content}`;
    })
    .join("\n\n---\n\n");

  const client = new LLMClient({ baseUrl: gatewayUrl });
  const completion = await client.complete({
    model: "claude-haiku-4-5-20251001",
    messages: [
      {
        role: "system",
        content: `You are Finchly, a helpful assistant that answers questions based on the user's saved links. Use ONLY the provided context to answer. Reference sources by their number [1], [2], etc. If the context doesn't contain enough information, say so honestly. Be concise.`,
      },
      {
        role: "user",
        content: `Context from saved links:\n\n${context}\n\n---\n\nQuestion: ${question}`,
      },
    ],
    fallbacks: ["claude-3-5-haiku-latest"],
  });

  return completion.content;
}

export async function getRecentLinks(
  db: Database,
  workspaceId: string,
  limit = 5,
): Promise<Array<{ id: string; url: string; title: string | null; createdAt: Date }>> {
  return db
    .select({
      id: links.id,
      url: links.url,
      title: links.title,
      createdAt: links.createdAt,
    })
    .from(links)
    .where(eq(links.workspaceId, workspaceId))
    .orderBy(desc(links.createdAt))
    .limit(limit);
}
