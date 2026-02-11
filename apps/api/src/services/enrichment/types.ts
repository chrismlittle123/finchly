import type { Database } from "@finchly/db";
import type { FinchlyEnv } from "../../config.js";
import type { SourceType } from "../../lib/source-type.js";
import type { FastifyBaseLogger } from "fastify";

export interface EnrichmentResult {
  title?: string;
  description?: string;
  imageUrl?: string;
  rawContent?: string;
  sourceType: SourceType;
  /** URLs extracted from the content (e.g. t.co links in tweets) */
  extractedUrls?: string[];
}

export interface LlmResult {
  summary: string;
  tags: string[];
}

export interface EnricherContext {
  db: Database;
  env: FinchlyEnv;
  logger: FastifyBaseLogger;
}
