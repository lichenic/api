import { db } from "#db/index.js";
import { apiTokens, users } from "#db/schema.js";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashToken, requireAuth } from "../middleware/auth.js";

export const botsRoute = new Hono<{
    Variables: { user: { id: string; username: string }; authVia: "session" | "token" };
}>();

// so bots can't make bots
botsRoute.use("*", requireAuth, async (c, next) => {
    if (c.get("authVia") !== "session") return c.json({ error: "session required" }, 403);
    await next();
});

async function mintToken(botId: string, name: string) {
    const token = "lch_" + randomBytes(32).toString("base64url");
    await db.insert(apiTokens).values({
        userId: botId,
        name,
        tokenHash: hashToken(token),
        prefix: token.slice(0, 8),
        expiresAt: null, // never expires
    });
    return token;
}

const createSchema = z.object({
    username: z
        .string()
        .min(3)
        .max(24)
        .regex(/^[a-z0-9_]+$/i),
});

botsRoute.post("/", async c => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);

    const { id: ownerId } = c.get("user");
    const { username } = parsed.data;

    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (taken) return c.json({ error: "username taken" }, 409);

    const [bot] = await db
        .insert(users)
        .values({ username, isBot: true, ownerId })
        .returning({ id: users.id, username: users.username });

    const token = await mintToken(bot.id, "default");
    return c.json({ ...bot, token }, 201); // token shown once
});

botsRoute.get("/", async c => {
    const { id: ownerId } = c.get("user");
    const rows = await db
        .select({ id: users.id, username: users.username, createdAt: users.createdAt })
        .from(users)
        .where(and(eq(users.ownerId, ownerId), eq(users.isBot, true)));
    return c.json(rows);
});

// issue a fresh token
botsRoute.post("/:id/tokens", async c => {
    const { id: ownerId } = c.get("user");
    const id = c.req.param("id");
    if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not found" }, 404);

    const [bot] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, id), eq(users.ownerId, ownerId), eq(users.isBot, true)))
        .limit(1);
    if (!bot) return c.json({ error: "not found" }, 404);

    return c.json({ token: await mintToken(bot.id, "regenerated") }, 201);
});

botsRoute.delete("/:id", async c => {
    const { id: ownerId } = c.get("user");
    const id = c.req.param("id");
    if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not found" }, 404);

    const deleted = await db
        .delete(users)
        .where(and(eq(users.id, id), eq(users.ownerId, ownerId), eq(users.isBot, true)))
        .returning({ id: users.id });
    if (!deleted.length) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
});
