import { db } from "#db";
import { apiTokens, sessions, users } from "#db/schema.js";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";

type AuthUser = { id: string; username: string };

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const requireAuth = createMiddleware<{
    Variables: { user: AuthUser; authVia: "session" | "token" };
}>(async (c, next) => {
    const header = c.req.header("authorization");

    if (header?.startsWith("Bearer ")) {
        const [row] = await db
            .select({ id: users.id, username: users.username, tokenId: apiTokens.id })
            .from(apiTokens)
            .innerJoin(users, eq(apiTokens.userId, users.id))
            .where(
                and(
                    eq(apiTokens.tokenHash, hashToken(header.slice(7))),
                    or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, new Date())),
                ),
            )
            .limit(1);
        if (!row) return c.fail("auth.unauthenticated", "unauthorized", 401);

        // fire and forget
        db.update(apiTokens)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiTokens.id, row.tokenId))
            .catch(() => {});

        c.set("user", { id: row.id, username: row.username });
        c.set("authVia", "token");
        return next();
    }

    const sessionId = getCookie(c, "session");
    if (!sessionId) return c.fail("auth.unauthenticated", "unauthorized", 401);

    const [row] = await db
        .select({ id: users.id, username: users.username })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
        .limit(1);
    if (!row) return c.fail("auth.unauthenticated", "unauthorized", 401);

    c.set("user", row);
    c.set("authVia", "session");
    await next();
});
