import { db } from "#db";
import { apiTokens } from "#db/schema.js";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashToken, requireAuth } from "../middleware/auth.js";

export const tokensRoute = new Hono<{
    Variables: { user: { id: string; username: string }; authVia: "session" | "token" };
}>();

// sessions only
tokensRoute.use("*", requireAuth, async (c, next) => {
    if (c.get("authVia") !== "session") return c.json({ error: "session required" }, 403);
    await next();
});

const createSchema = z.object({
    name: z.string().min(1).max(64),
    expiresInDays: z.number().int().min(1).max(3650).optional(),
});

tokensRoute.post("/", async c => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);

    const { id: userId } = c.get("user");
    const { name, expiresInDays } = parsed.data;
    const token = "lch_" + randomBytes(32).toString("base64url");
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null;

    const [row] = await db
        .insert(apiTokens)
        .values({ userId, name, tokenHash: hashToken(token), prefix: token.slice(0, 8), expiresAt })
        .returning({ id: apiTokens.id, name: apiTokens.name, expiresAt: apiTokens.expiresAt });
    return c.json({ ...row, token }, 201);
});

tokensRoute.get("/", async c => {
    const { id: userId } = c.get("user");
    const rows = await db
        .select({
            id: apiTokens.id,
            name: apiTokens.name,
            prefix: apiTokens.prefix,
            expiresAt: apiTokens.expiresAt,
            lastUsedAt: apiTokens.lastUsedAt,
            createdAt: apiTokens.createdAt,
        })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))
        .orderBy(desc(apiTokens.createdAt));
    return c.json(rows);
});

tokensRoute.delete("/:id", async c => {
    const { id: userId } = c.get("user");
    const id = c.req.param("id");
    if (!z.uuid().safeParse(id).success) return c.json({ error: "not found" }, 404);

    const deleted = await db
        .delete(apiTokens)
        .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
        .returning({ id: apiTokens.id });
    if (!deleted.length) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
});
