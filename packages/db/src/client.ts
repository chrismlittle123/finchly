import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/links.js";

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
