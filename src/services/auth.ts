import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { db } from "#db";
import { sessions, users } from "#db/schema.js";

export type AuthSession = {
    id: string;
    userId: string;
    expiresAt: Date;
    user: {
        id: string;
        username: string;
        email: string;
        createdAt: Date;
    };
};

export type SessionVariables = {
    session: AuthSession;
};

export function getBearerToken(c: { req: { header(name: string): string | undefined } }) {
    const authorization = c.req.header("Authorization");
    if (!authorization?.startsWith("Bearer ")) return null;

    const token = authorization.slice("Bearer ".length).trim();
    return token || null;
}

export const requireSession = createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
    const token = getBearerToken(c);
    if (!token) return c.json({ error: "not authenticated" }, 401);

    const [session] = await db
        .select({
            id: sessions.id,
            userId: sessions.userId,
            expiresAt: sessions.expiresAt,
            user: {
                id: users.id,
                username: users.username,
                email: users.email,
                createdAt: users.createdAt,
            },
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, token))
        .limit(1);

    if (!session) return c.json({ error: "not authenticated" }, 401);

    if (session.expiresAt < new Date()) {
        await db.delete(sessions).where(eq(sessions.id, token));
        return c.json({ error: "session expired" }, 401);
    }

    c.set("session", session);
    await next();
});