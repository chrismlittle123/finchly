import { z } from "@progression-labs/fastify-api";
import type { FastifyInstance } from "fastify";
import { links, slackWorkspaces, eq } from "@finchly/db";
import { WebClient } from "@slack/web-api";
import { verifySlackSignature } from "../../lib/slack.js";
import { extractUrls } from "../../lib/urls.js";
import { enrichLink } from "../../services/enrichment/pipeline.js";
import { askQuestion, getRecentLinks } from "../../services/rag.js";
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
  channel_type: z.string().optional(),
  bot_id: z.string().optional(),
});

const appUninstalledEventSchema = z.object({
  type: z.literal("app_uninstalled"),
});

const eventCallbackSchema = z.object({
  type: z.literal("event_callback"),
  team_id: z.string(),
  event: z.union([linkSharedEventSchema, messageEventSchema, appUninstalledEventSchema]),
});

const slackPayloadSchema = z.union([urlVerificationSchema, eventCallbackSchema]);

function formatRagResponse(
  answer: string,
  sources: Array<{ url: string; title: string | null }>,
): string {
  let text = answer;

  if (sources.length > 0) {
    text += "\n\n*Sources:*\n";
    text += sources
      .map((s) => `• <${s.url}|${s.title ?? s.url}>`)
      .join("\n");
  }

  return text;
}

function formatRecentLinks(
  recentLinks: Array<{ url: string; title: string | null }>,
): string {
  if (recentLinks.length === 0) {
    return "No links saved yet in this workspace. Try sharing some links in a channel I'm in!";
  }

  let text = "*Recent links:*\n";
  text += recentLinks
    .map((l) => `• <${l.url}|${l.title ?? l.url}>`)
    .join("\n");

  return text;
}

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

    const { event, team_id } = payload;

    // Look up workspace by team_id
    const workspace = await db.query.slackWorkspaces.findFirst({
      where: eq(slackWorkspaces.teamId, team_id),
    });

    if (!workspace || workspace.uninstalledAt) {
      request.log.warn({ team_id }, "Event from unknown or uninstalled workspace");
      return reply.send({ ok: true });
    }

    // Handle app_uninstalled event
    if (event.type === "app_uninstalled") {
      await db
        .update(slackWorkspaces)
        .set({ uninstalledAt: new Date(), updatedAt: new Date() })
        .where(eq(slackWorkspaces.teamId, team_id));

      request.log.info({ team_id }, "Slack workspace uninstalled");
      return reply.send({ ok: true });
    }

    // Handle DM messages — fire-and-forget RAG query
    if (event.type === "message" && event.channel_type === "im") {
      if (event.bot_id || !event.text) {
        return reply.send({ ok: true });
      }

      const channel = event.channel;
      const text = event.text;
      const slackClient = new WebClient(workspace.botToken);

      // Fire-and-forget so we respond to Slack within 3s
      (async () => {
        try {
          const trimmed = text.trim().toLowerCase();

          let responseText: string;

          if (trimmed === "recent" || trimmed === "latest") {
            const recent = await getRecentLinks(db, workspace.id);
            responseText = formatRecentLinks(recent);
          } else {
            if (!env.OPENAI_API_KEY || !env.LLM_GATEWAY_URL) {
              responseText = "RAG search is not configured. Please contact your admin.";
            } else {
              const result = await askQuestion(text, {
                db,
                env,
                logger: request.log,
                workspaceId: workspace.id,
              });
              responseText = result.sources.length > 0
                ? formatRagResponse(result.answer, result.sources)
                : "I don't have any relevant links to answer that question. Try sharing some links in a channel I'm in!";
            }
          }

          await slackClient.chat.postMessage({
            channel,
            text: responseText,
          });
        } catch (err) {
          request.log.error({ err, channel }, "Failed to handle DM query");
        }
      })();

      return reply.send({ ok: true });
    }

    // Handle channel messages and link_shared — extract URLs
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

    if (urls.length > 0) {
      const newLinks = urls.map((url) => ({
        url,
        workspaceId: workspace.id,
        slackChannelId: channelId ?? "",
        slackUserId: userId,
        slackMessageTs: messageTs,
      }));

      await db
        .insert(links)
        .values(newLinks)
        .onConflictDoNothing({ target: [links.url, links.workspaceId] });

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
