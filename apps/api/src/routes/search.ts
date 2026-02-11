import { z, defineRoute, registerRoute, AppError } from "@palindrom/fastify-api";
import type { FastifyInstance } from "fastify";
import { links, desc, gt, and, isNotNull, cosineDistance, sql } from "@finchly/db";
import type { FinchlyEnv } from "../config.js";
import { generateEmbedding } from "../services/enrichment/embedding.js";
import type { EnricherContext } from "../services/enrichment/types.js";
import Anthropic from "@anthropic-ai/sdk";

const searchResultSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  summary: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  imageUrl: z.string().nullable(),
  sourceType: z.string().nullable(),
  similarity: z.number(),
});

function buildSearchRoute(app: FastifyInstance, env: FinchlyEnv) {
  const db = app.finchlyDb;

  return defineRoute({
    method: "POST",
    url: "/v1/search",
    auth: "jwt",
    tags: ["Search"],
    summary: "Semantic search over links",
    schema: {
      body: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).default(5),
        threshold: z.number().min(0).max(1).default(0.3),
      }),
      response: {
        200: z.object({
          data: z.array(searchResultSchema),
          query: z.string(),
        }),
      },
    },
    handler: async (request) => {
      if (!env.OPENAI_API_KEY) {
        throw AppError.badRequest("OPENAI_API_KEY not configured — search unavailable");
      }

      const { query, limit, threshold } = request.body;

      const ctx: EnricherContext = {
        db,
        env,
        logger: request.log,
      };

      const queryEmbedding = await generateEmbedding(query, ctx);
      if (!queryEmbedding) {
        throw AppError.badRequest("Failed to generate query embedding");
      }

      const similarity = sql<number>`1 - (${cosineDistance(links.embedding, queryEmbedding)})`;

      const results = await db
        .select({
          id: links.id,
          url: links.url,
          title: links.title,
          description: links.description,
          summary: links.summary,
          tags: links.tags,
          imageUrl: links.imageUrl,
          sourceType: links.sourceType,
          similarity,
        })
        .from(links)
        .where(and(isNotNull(links.embedding), gt(similarity, threshold)))
        .orderBy((t) => desc(t.similarity))
        .limit(limit);

      return { data: results, query };
    },
  });
}

function buildAskRoute(app: FastifyInstance, env: FinchlyEnv) {
  const db = app.finchlyDb;

  return defineRoute({
    method: "POST",
    url: "/v1/ask",
    auth: "jwt",
    tags: ["Search"],
    summary: "Ask a question about your links (RAG)",
    schema: {
      body: z.object({
        question: z.string().min(1),
      }),
      response: {
        200: z.object({
          answer: z.string(),
          sources: z.array(z.object({
            id: z.string(),
            url: z.string(),
            title: z.string().nullable(),
            similarity: z.number(),
          })),
        }),
      },
    },
    handler: async (request) => {
      if (!env.OPENAI_API_KEY) {
        throw AppError.badRequest("OPENAI_API_KEY not configured — search unavailable");
      }
      if (!env.ANTHROPIC_API_KEY) {
        throw AppError.badRequest("ANTHROPIC_API_KEY not configured — ask unavailable");
      }

      const { question } = request.body;

      const ctx: EnricherContext = {
        db,
        env,
        logger: request.log,
      };

      // Step 1: Embed the question
      const queryEmbedding = await generateEmbedding(question, ctx);
      if (!queryEmbedding) {
        throw AppError.badRequest("Failed to generate query embedding");
      }

      // Step 2: Find relevant links
      const similarity = sql<number>`1 - (${cosineDistance(links.embedding, queryEmbedding)})`;

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
        .where(and(isNotNull(links.embedding), gt(similarity, 0.3)))
        .orderBy((t) => desc(t.similarity))
        .limit(5);

      if (results.length === 0) {
        return {
          answer: "I don't have any relevant links to answer that question.",
          sources: [],
        };
      }

      // Step 3: Build context from top results
      const context = results
        .map((r, i) => {
          const content = r.rawContent
            ? r.rawContent.slice(0, 2000)
            : r.summary ?? "No content available";
          return `[${i + 1}] ${r.title ?? r.url}\nURL: ${r.url}\n${content}`;
        })
        .join("\n\n---\n\n");

      // Step 4: Ask Claude
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are Finchly, a helpful assistant that answers questions based on the user's saved links. Use ONLY the provided context to answer. Reference sources by their number [1], [2], etc. If the context doesn't contain enough information, say so honestly. Be concise.`,
        messages: [{
          role: "user",
          content: `Context from saved links:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        }],
      });

      const answer = message.content[0].type === "text" ? message.content[0].text : "";

      return {
        answer,
        sources: results.map((r) => ({
          id: r.id,
          url: r.url,
          title: r.title,
          similarity: r.similarity,
        })),
      };
    },
  });
}

export function registerSearchRoutes(app: FastifyInstance, opts: { env: FinchlyEnv }) {
  registerRoute(app, buildSearchRoute(app, opts.env));
  registerRoute(app, buildAskRoute(app, opts.env));
}
