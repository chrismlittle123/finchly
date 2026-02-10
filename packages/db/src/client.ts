import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/links.js";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(connectionString: string) {
  if (!db) {
    const ssl = connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined;
    const pool = new pg.Pool({ connectionString, ssl });
    db = drizzle(pool, { schema });
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
