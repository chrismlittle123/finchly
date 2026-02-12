import type { FastifyInstance } from "fastify";
import { WebClient } from "@slack/web-api";
import { slackWorkspaces } from "@finchly/db";
import type { FinchlyEnv } from "../../config.js";

const BOT_SCOPES = [
  "channels:history",
  "channels:read",
  "chat:write",
  "links:read",
  "links:write",
].join(",");

export function registerSlackInstallRoutes(
  app: FastifyInstance,
  opts: { env: FinchlyEnv },
) {
  const { env } = opts;
  const db = app.finchlyDb;

  app.get("/slack/install", async (_request, reply) => {
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID as string,
      scope: BOT_SCOPES,
      redirect_uri: `${env.APP_BASE_URL}/slack/oauth/callback`,
    });

    return reply.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
  });

  app.get("/slack/oauth/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };

    if (!code) {
      return reply.status(400).send({ error: { code: "BAD_REQUEST", message: "Missing code parameter" } });
    }

    const client = new WebClient();

    const result = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID as string,
      client_secret: env.SLACK_CLIENT_SECRET as string,
      code,
      redirect_uri: `${env.APP_BASE_URL}/slack/oauth/callback`,
    });

    if (!result.ok || !result.team?.id || !result.access_token || !result.bot_user_id) {
      app.log.error({ result }, "Slack OAuth exchange failed");
      return reply.status(502).send({ error: { code: "OAUTH_FAILED", message: "Slack OAuth exchange failed" } });
    }

    await db
      .insert(slackWorkspaces)
      .values({
        teamId: result.team.id,
        teamName: result.team.name ?? result.team.id,
        botToken: result.access_token,
        botUserId: result.bot_user_id,
        installedBy: result.authed_user?.id ?? "unknown",
        scope: result.scope ?? "",
      })
      .onConflictDoUpdate({
        target: slackWorkspaces.teamId,
        set: {
          teamName: result.team.name ?? result.team.id,
          botToken: result.access_token,
          botUserId: result.bot_user_id,
          installedBy: result.authed_user?.id ?? "unknown",
          scope: result.scope ?? "",
          uninstalledAt: null,
          updatedAt: new Date(),
        },
      });

    app.log.info({ teamId: result.team.id, teamName: result.team.name }, "Slack workspace installed");

    return reply.send({ ok: true, team: result.team.name });
  });
}
