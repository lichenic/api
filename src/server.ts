import "dotenv/config";

import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { log } from "./lib/logger.js";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";

const port = Number(process.env.PORT) || 3011;

try {
  await db.execute(sql`select 1`);
  serve({ fetch: app.fetch, port });
  log.info({ port }, "server started");
} catch (err) {
  log.fatal({ err }, "database connection failed");
  process.exit(1);
}
