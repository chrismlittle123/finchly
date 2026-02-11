import { z } from "@progression-labs/fastify-api";
import type { FastifyInstance } from "fastify";
import { links } from "@finchly/db";
import { verifySlackSignature } from "../../lib/slack.js";
import { extractUrls } from "../../lib/urls.js";
import { enrichLink } from "../../services/enrichment/pipeline.js";
import type { FinchlyEnv } from "../../config.js";

const urlVerificationSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string(),
});

const linkSharedEventSchema = z.object({
  type: z.literal("link_shared"),
  channel: z.string(),
  user: z.string(),
  message_ts: z.string(),
  links: z.array(z.object({ url: z.string(), domain: z.string() })),
});

const messageEventSchema = z.object({
  type: z.literal("message"),
  channel: z.string(),
  user: z.string().optional(),
  ts: z.string(),
  text: z.string().optional(),
});

const eventCallbackSchema = z.object({
  type: z.literal("event_callback"),
  event: z.union([linkSharedEventSchema, messageEventSchema]),
});

const slackPayloadSchema = z.union([urlVerificationSchema, eventCallbackSchema]);

export function registerSlackRoutes(
  app: FastifyInstance,
  opts: { env: FinchlyEnv },
) {
  const { env } = opts;
  const db = app.finchlyDb;

  app.post("/slack/events", async (request, reply) => {
    const rawBody = (request as unknown as { rawBody: Buffer }).rawBody;

    const isValid = verifySlackSignature(
      env.SLACK_SIGNING_SECRET as string,
      request.headers["x-slack-signature"] as string | undefined,
      request.headers["x-slack-request-timestamp"] as string | undefined,
      rawBody,
    );

    if (!isValid) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid signature" } });
    }

    const parsed = slackPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Invalid payload" } });
    }

    const payload = parsed.data;

    if (payload.type === "url_verification") {
      return reply.send({ challenge: payload.challenge });
    }

    const { event } = payload;

    let urls: string[] = [];
    let channelId: string | undefined;
    let userId: string | undefined;
    let messageTs: string | undefined;

    if (event.type === "link_shared") {
      urls = event.links.map((l) => l.url);
      channelId = event.channel;
      userId = event.user;
      messageTs = event.message_ts;
    } else if (event.type === "message") {
      urls = extractUrls(event.text);
      channelId = event.channel;
      userId = event.user;
      messageTs = event.ts;
    }

    if (urls.length > 0 && channelId === env.SLACK_CHANNEL_ID) {
      const newLinks = urls.map((url) => ({
        url,
        slackChannelId: channelId ?? "",
        slackUserId: userId,
        slackMessageTs: messageTs,
      }));

      await db
        .insert(links)
        .values(newLinks)
        .onConflictDoNothing({ target: links.url });

      // Fire-and-forget enrichment (Slack requires response within 3s)
      for (const url of urls) {
        enrichLink(url, { db, env, logger: request.log }).catch((err) => {
          request.log.error({ err, url }, "Background enrichment failed");
        });
      }
    }

    return reply.send({ ok: true });
  });
}
