import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { getDb } from "@finchly/db";
import { healthRoutes } from "./routes/health.js";
import { slackEventRoutes } from "./routes/slack/events.js";

const config = loadConfig();
const db = getDb(config.DATABASE_URL);

const app = Fastify({ logger: true });

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
app.register(healthRoutes);
app.register(slackEventRoutes, { config, db });

async function start() {
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
