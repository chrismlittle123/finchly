import type { FastifyInstance } from "fastify";
import { links, slackWorkspaces, eq } from "@finchly/db";
import { WebClient } from "@slack/web-api";
import { verifySlackSignature } from "../../lib/slack.js";
import { extractUrls } from "../../lib/urls.js";
import { enrichLink } from "../../services/enrichment/pipeline.js";
import type { FinchlyEnv } from "../../config.js";

interface SlackCommandBody {
  command: string;
  channel_id: string;
  team_id: string;
  user_id: string;
  response_url: string;
}

export function registerSlackBackfillRoutes(
  app: FastifyInstance,
  opts: { env: FinchlyEnv },
) {
  const { env } = opts;
  const db = app.finchlyDb;

  app.post("/slack/commands", async (request, reply) => {
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

    const body = request.body as SlackCommandBody;

    const workspace = await db.query.slackWorkspaces.findFirst({
      where: eq(slackWorkspaces.teamId, body.team_id),
    });

    if (!workspace || workspace.uninstalledAt) {
      return reply.status(200).send({ text: "Workspace not found. Please reinstall Finchly." });
    }

    const slackClient = new WebClient(workspace.botToken);
    const channelId = body.channel_id;
    const responseUrl = body.response_url;

    // Respond immediately — Slack requires response within 3s
    reply.send({ text: "Starting backfill... I'll post a summary when done." });

    // Fire-and-forget async backfill
    (async () => {
      let totalLinks = 0;
      let cursor: string | undefined;

      try {
        do {
          const result = await slackClient.conversations.history({
            channel: channelId,
            limit: 100,
            cursor,
          });

          for (const message of result.messages ?? []) {
            const urls = extractUrls(message.text);
            if (urls.length === 0) continue;

            const newLinks = urls.map((url) => ({
              url,
              workspaceId: workspace.id,
              slackChannelId: channelId,
              slackUserId: message.user,
              slackMessageTs: message.ts,
            }));

            await db
              .insert(links)
              .values(newLinks)
              .onConflictDoNothing({ target: [links.url, links.workspaceId] });

            for (const url of urls) {
              enrichLink(url, { db, env, logger: request.log }).catch((err) => {
                request.log.error({ err, url }, "Backfill enrichment failed");
              });
            }

            totalLinks += urls.length;
          }

          cursor = result.response_metadata?.next_cursor || undefined;
        } while (cursor);

        // Post summary via response_url
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Backfill complete: found ${totalLinks} links`,
            response_type: "ephemeral",
          }),
        });
      } catch (err) {
        request.log.error({ err, channelId }, "Backfill failed");
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Backfill failed. Check the logs for details.",
            response_type: "ephemeral",
          }),
        }).catch(() => {});
      }
    })();
  });
}
