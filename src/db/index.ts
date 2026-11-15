import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { log } from "#api/lib/logger.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

pool.on("connect", client => {
  log.info("database connection established");
});

pool.on("error", err => {
  log.error({ err }, "database pool error");
});

pool.on("remove", () => {
  log.info("database connection removed");
});

export const db = drizzle(pool, { schema });