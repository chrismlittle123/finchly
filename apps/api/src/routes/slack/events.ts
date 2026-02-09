import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { links } from "@finchly/db";
import { verifySlackSignature } from "../../lib/slack.js";
import type { Env } from "../../config.js";
import type { Database } from "@finchly/db";

// Slack event schemas
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

// Extract URLs from message text
const URL_REGEX = /https?:\/\/[^\s>]+/g;

function extractUrls(text: string | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(URL_REGEX)].map((m) => m[0]);
}

export async function slackEventRoutes(
  app: FastifyInstance,
  opts: { config: Env; db: Database },
) {
  const { config, db } = opts;

  app.post("/slack/events", async (request, reply) => {
    const rawBody = (request as unknown as { rawBody: Buffer }).rawBody;

    // Verify Slack signature
    const isValid = verifySlackSignature(
      config.SLACK_SIGNING_SECRET,
      request.headers["x-slack-signature"] as string | undefined,
      request.headers["x-slack-request-timestamp"] as string | undefined,
      rawBody,
    );

    if (!isValid) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    const parsed = slackPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid payload" });
    }

    const payload = parsed.data;

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
      return reply.send({ challenge: payload.challenge });
    }

    // Handle event callbacks
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

    if (urls.length > 0 && channelId === config.SLACK_CHANNEL_ID) {
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
    }

    return reply.send({ ok: true });
  });
}
