import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as linksSchema from "./schema/links.js";
import * as slackWorkspacesSchema from "./schema/slack-workspaces.js";

const schema = { ...linksSchema, ...slackWorkspacesSchema };

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(connectionString: string) {
  if (!db) {
    const needsSsl = connectionString.includes("sslmode=");
    const cleanedUrl = connectionString.replace(/[?&]sslmode=[^&]*/g, "");
    const pool = new pg.Pool({
      connectionString: cleanedUrl,
      ...(needsSsl && { ssl: { rejectUnauthorized: false } }),
    });
    db = drizzle(pool, { schema });
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
