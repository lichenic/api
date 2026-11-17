import { db } from "#db";
import { apiTokens, sessions, users } from "#db/schema.js";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";

export type AuthUser = { id: string; username: string };
export type AuthVia = "session" | "token";

export type AuthVariables = {
    user: AuthUser;
    authVia: AuthVia;
};

export type OptionalAuthVariables = {
    user?: AuthUser;
    authVia?: AuthVia;
};

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

type AuthResult =
    | { status: "anonymous" }
    | { status: "unauthorized" }
    | { status: "authenticated"; user: AuthUser; via: AuthVia };

async function authenticate(c: Context): Promise<AuthResult> {
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
        if (!row) return { status: "unauthorized" };

        // fire and forget
        db.update(apiTokens)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiTokens.id, row.tokenId))
            .catch(() => {});

        return {
            status: "authenticated",
            user: { id: row.id, username: row.username },
            via: "token",
        };
    }

    const sessionId = getCookie(c, "session");
    if (!sessionId) return { status: "anonymous" };

    const [row] = await db
        .select({ id: users.id, username: users.username })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
        .limit(1);
    if (!row) return { status: "unauthorized" };

    return { status: "authenticated", user: row, via: "session" };
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const auth = await authenticate(c);
    if (auth.status !== "authenticated") return c.fail("auth.unauthenticated", "unauthorized", 401);

    c.set("user", auth.user);
    c.set("authVia", auth.via);
    await next();
});

export const optionalAuth = createMiddleware<{ Variables: OptionalAuthVariables }>(async (c, next) => {
    const auth = await authenticate(c);
    if (auth.status === "unauthorized") return c.fail("auth.unauthenticated", "unauthorized", 401);

    if (auth.status === "authenticated") {
        c.set("user", auth.user);
        c.set("authVia", auth.via);
    }

    await next();
});
