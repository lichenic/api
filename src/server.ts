import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT) || 3011;
serve({ fetch: app.fetch, port });
console.log(`listening on http://localhost:${port}`);
