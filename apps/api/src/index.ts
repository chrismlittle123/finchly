import { createApp } from "@palindrom/fastify-api";
import { loadConfig } from "./config.js";
import { getDb } from "@finchly/db";
import type { Database } from "@finchly/db";
import { registerLinkRoutes } from "./routes/links.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerSlackRoutes } from "./routes/slack/events.js";

declare module "fastify" {
  interface FastifyInstance {
    finchlyDb: Database;
  }
}

const { appConfig, env } = loadConfig();

const app = await createApp(appConfig);

// Decorate with our own DB instance (skip fastify-api's built-in db)
const db = getDb(env.DATABASE_URL);
app.decorate("finchlyDb", db);

// Custom content type parser to preserve rawBody for Slack signature verification
app.addContentTypeParser(
  "application/json",
  { parseAs: "buffer" },
  (req, body, done) => {
    (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
    try {
      const json = JSON.parse((body as Buffer).toString("utf-8"));
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  },
);

// Register routes
registerLinkRoutes(app, { env });
registerSearchRoutes(app, { env });

if (env.SLACK_BOT_TOKEN && env.SLACK_SIGNING_SECRET && env.SLACK_CHANNEL_ID) {
  registerSlackRoutes(app, { env });
} else {
  app.log.warn("Slack env vars not set — Slack routes disabled");
}

// Graceful shutdown
const shutdown = async () => {
  app.log.info("Shutting down...");
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.start();
