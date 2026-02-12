import { z, defineRoute, registerRoute, AppError } from "@progression-labs/fastify-api";
import type { FastifyInstance } from "fastify";
import { links, desc, gt, and, isNotNull, cosineDistance, sql } from "@finchly/db";
import type { FinchlyEnv } from "../config.js";
import { generateEmbedding } from "../services/enrichment/embedding.js";
import type { EnricherContext } from "../services/enrichment/types.js";
import { askQuestion } from "../services/rag.js";

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
      if (!env.LLM_GATEWAY_URL) {
        throw AppError.badRequest("LLM_GATEWAY_URL not configured — ask unavailable");
      }

      const { question } = request.body;

      return askQuestion(question, { db, env, logger: request.log });
    },
  });
}

export function registerSearchRoutes(app: FastifyInstance, opts: { env: FinchlyEnv }) {
  registerRoute(app, buildSearchRoute(app, opts.env));
  registerRoute(app, buildAskRoute(app, opts.env));
}
