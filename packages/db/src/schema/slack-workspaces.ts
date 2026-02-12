import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { slackWorkspaceId } from "../ids.js";

export const slackWorkspaces = pgTable(
  "slack_workspaces",
  {
    id: text("id").primaryKey().$defaultFn(() => slackWorkspaceId()),
    teamId: text("team_id").notNull(),
    teamName: text("team_name").notNull(),
    botToken: text("bot_token").notNull(),
    botUserId: text("bot_user_id").notNull(),
    installedBy: text("installed_by").notNull(),
    scope: text("scope").notNull(),
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("slack_workspaces_team_id_idx").on(table.teamId)],
);

export type SlackWorkspace = typeof slackWorkspaces.$inferSelect;
export type NewSlackWorkspace = typeof slackWorkspaces.$inferInsert;
