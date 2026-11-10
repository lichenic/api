import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/", c => c.text("lichenic server is running!"));
app.get("/health", c => c.json({ ok: true }));

const port = Number(process.env.PORT) || 3011;
serve({ fetch: app.fetch, port });
console.log(`listening on http://localhost:${port}`);
