import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { links, eq, desc } from "@finchly/db";
import type { Database } from "@finchly/db";
import type { Env } from "../config.js";

const createLinkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function linksRoutes(
  app: FastifyInstance,
  opts: { config: Env; db: Database },
) {
  const { db } = opts;

  // GET /links — list all links
  app.get("/links", async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    const rows = parsedLimit
      ? await db.select().from(links).orderBy(desc(links.createdAt)).limit(parsedLimit)
      : await db.select().from(links).orderBy(desc(links.createdAt));

    return reply.send(rows);
  });

  // GET /links/:id — get single link
  app.get("/links/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [row] = await db.select().from(links).where(eq(links.id, id));

    if (!row) {
      return reply.status(404).send({ error: "Link not found" });
    }

    return reply.send(row);
  });

  // POST /links — create a link
  app.post("/links", async (request, reply) => {
    const parsed = createLinkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    try {
      const [row] = await db.insert(links).values(parsed.data).returning();
      return reply.status(201).send(row);
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "23505"
      ) {
        return reply.status(409).send({ error: "URL already exists" });
      }
      throw err;
    }
  });

  // DELETE /links/:id — delete a link
  app.delete("/links/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(links).where(eq(links.id, id)).returning();

    if (!deleted) {
      return reply.status(404).send({ error: "Link not found" });
    }

    return reply.status(204).send();
  });
}
