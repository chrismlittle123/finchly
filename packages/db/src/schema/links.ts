import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { linkId } from "../ids.js";

export const links = pgTable(
  "links",
  {
    id: text("id").primaryKey().$defaultFn(() => linkId()),
    url: text("url").notNull(),
    title: text("title"),
    summary: text("summary"),
    tags: jsonb("tags").$type<string[]>().default([]),
    embedding: vector("embedding", { dimensions: 1536 }),
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
    index("links_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
