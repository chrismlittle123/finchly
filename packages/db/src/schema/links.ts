import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const links = pgTable(
  "links",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    url: text("url").notNull(),
    title: text("title"),
    summary: text("summary"),
    tags: jsonb("tags").$type<string[]>().default([]),
    embedding: text("embedding"), // stored as pgvector via raw SQL migration
    slackMessageTs: text("slack_message_ts"),
    slackChannelId: text("slack_channel_id"),
    slackUserId: text("slack_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("links_url_idx").on(table.url),
    index("links_tags_idx").using("gin", table.tags),
    index("links_created_at_idx").on(table.createdAt),
  ],
);

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
