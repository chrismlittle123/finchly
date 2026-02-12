import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

// — slack_workspaces ——————————————————————————————————————————————————————————

export const slackWorkspaces = pgTable(
  "slack_workspaces",
  {
    id: text("id").primaryKey().$defaultFn(() => `swk_${nanoid(21)}`),
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

// — links ————————————————————————————————————————————————————————————————————

export const links = pgTable(
  "links",
  {
    id: text("id").primaryKey().$defaultFn(() => `lnk_${nanoid(21)}`),
    url: text("url").notNull(),
    title: text("title"),
    summary: text("summary"),
    tags: jsonb("tags").$type<string[]>().default([]),
    embedding: vector("embedding", { dimensions: 1536 }),
    workspaceId: text("workspace_id").references(() => slackWorkspaces.id),
    slackMessageTs: text("slack_message_ts"),
    slackChannelId: text("slack_channel_id"),
    slackUserId: text("slack_user_id"),
    description: text("description"),
    imageUrl: text("image_url"),
    rawContent: text("raw_content"),
    sourceType: text("source_type"),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("links_url_workspace_idx").on(table.url, table.workspaceId),
    index("links_tags_idx").using("gin", table.tags),
    index("links_created_at_idx").on(table.createdAt),
    index("links_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
