import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { auth } from "./auth.js";

const app = new Hono();

app.get("/", c => c.text("lichenic server is running!"));
app.get("/health", c => c.json({ ok: true }));
app.route("/auth", auth);

const port = Number(process.env.PORT) || 3011;
serve({ fetch: app.fetch, port });
console.log(`listening on http://localhost:${port}`);
