CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"summary" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"embedding" vector(1536),
	"slack_message_ts" text,
	"slack_channel_id" text,
	"slack_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "links_url_idx" ON "links" USING btree ("url");--> statement-breakpoint
CREATE INDEX "links_tags_idx" ON "links" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "links_created_at_idx" ON "links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "links_embedding_idx" ON "links" USING hnsw ("embedding" vector_cosine_ops);