import { z, defineRoute, registerRoute, AppError } from "@progression-labs/fastify-api";
import type { FastifyInstance, FastifyReply } from "fastify";
import { links, eq, desc, lt } from "@finchly/db";
import type { Link } from "@finchly/db";
import { enrichLink } from "../services/enrichment/pipeline.js";
import type { FinchlyEnv } from "../config.js";

function serializeLink(link: Link, includeRawContent = false) {
  return {
    id: link.id,
    url: link.url,
    title: link.title,
    description: link.description,
    summary: link.summary,
    tags: link.tags,
    imageUrl: link.imageUrl,
    sourceType: link.sourceType,
    ...(includeRawContent && { rawContent: link.rawContent }),
    enrichedAt: link.enrichedAt?.toISOString() ?? null,
    slackMessageTs: link.slackMessageTs,
    slackChannelId: link.slackChannelId,
    slackUserId: link.slackUserId,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

const linkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  summary: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  imageUrl: z.string().nullable(),
  sourceType: z.string().nullable(),
  enrichedAt: z.string().nullable(),
  slackMessageTs: z.string().nullable(),
  slackChannelId: z.string().nullable(),
  slackUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const linkDetailSchema = linkSchema.extend({
  rawContent: z.string().nullable(),
});

function buildListRoute(app: FastifyInstance) {
  const db = app.finchlyDb;

  return defineRoute({
    method: "GET",
    url: "/v1/links",
    auth: "jwt",
    tags: ["Links"],
    summary: "List links",
    schema: {
      querystring: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
      response: {
        200: z.object({
          data: z.array(linkSchema),
          nextCursor: z.string().nullable(),
          hasMore: z.boolean(),
        }),
      },
    },
    handler: async (request) => {
      const { limit, cursor } = request.query;

      const query = db
        .select()
        .from(links)
        .orderBy(desc(links.createdAt))
        .limit(limit + 1);

      const rows = cursor
        ? await query.where(lt(links.createdAt, new Date(cursor)))
        : await query;

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1].createdAt.toISOString() : null;

      return { data: data.map((row) => serializeLink(row)), nextCursor, hasMore };
    },
  });
}

function buildGetRoute(app: FastifyInstance) {
  const db = app.finchlyDb;

  return defineRoute({
    method: "GET",
    url: "/v1/links/:id",
    auth: "jwt",
    tags: ["Links"],
    summary: "Get a link by ID",
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: linkDetailSchema },
    },
    handler: async (request) => {
      const { id } = request.params;
      const [row] = await db.select().from(links).where(eq(links.id, id));
      if (!row) throw AppError.notFound("Link", id);
      return serializeLink(row, true);
    },
  });
}

function buildCreateRoute(app: FastifyInstance, env: FinchlyEnv) {
  const db = app.finchlyDb;

  return defineRoute({
    method: "POST",
    url: "/v1/links",
    auth: "jwt",
    tags: ["Links"],
    summary: "Create a link",
    schema: {
      body: z.object({
        url: z.string().url(),
        title: z.string().optional(),
        summary: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
      response: { 201: linkSchema },
    },
    handler: async (request, reply: FastifyReply | undefined) => {
      try {
        const [row] = await db.insert(links).values(request.body).returning();
        if (reply) reply.status(201);

        // Fire-and-forget enrichment
        enrichLink(request.body.url, { db, env, logger: request.log }).catch((err) => {
          request.log.error({ err, url: request.body.url }, "Background enrichment failed");
        });

        return serializeLink(row);
      } catch (err: unknown) {
        if (isUniqueViolation(err)) throw AppError.conflict("URL already exists");
        throw err;
      }
    },
  });
}

function buildDeleteRoute(app: FastifyInstance) {
  const db = app.finchlyDb;

  return defineRoute({
    method: "DELETE",
    url: "/v1/links/:id",
    auth: "jwt",
    tags: ["Links"],
    summary: "Delete a link",
    schema: {
      params: z.object({ id: z.string() }),
    },
    handler: async (request, reply: FastifyReply | undefined) => {
      const { id } = request.params;
      const [deleted] = await db.delete(links).where(eq(links.id, id)).returning();
      if (!deleted) throw AppError.notFound("Link", id);
      if (reply) reply.status(204);
    },
  });
}

export function registerLinkRoutes(app: FastifyInstance, opts: { env: FinchlyEnv }) {
  registerRoute(app, buildListRoute(app));
  registerRoute(app, buildGetRoute(app));
  registerRoute(app, buildCreateRoute(app, opts.env));
  registerRoute(app, buildDeleteRoute(app));
}
