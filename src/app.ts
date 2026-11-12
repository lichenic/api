import { Hono } from "hono";
import { auth } from "./routes/auth.js";

export const app = new Hono();

app.get("/", c => c.text("lichenic server is running!"));
app.get("/health", c => c.json({ ok: true }));
app.route("/auth", auth);