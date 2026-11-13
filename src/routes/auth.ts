import argon2 from "argon2";
import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "#db";
import { sessions, users } from "#db/schema.js";

export const auth = new Hono();

const SESSION_DAYS = 7;

const registerSchema = z.object({
    username: z
        .string()
        .min(3)
        .max(24)
        .regex(/^[a-z0-9_]+$/i),
    email: z.email(),
    password: z.string().min(8).max(128),
});

const loginSchema = z.object({
    identifier: z.string().min(1), // email or username
    password: z.string().min(1),
});

async function startSession(c: any, userId: string) {
    const id = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await db.insert(sessions).values({ id, userId, expiresAt });
    setCookie(c, "session", id, {
        httpOnly: true,
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: expiresAt,
    });
}

auth.post("/register", async c => {
    const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);

    const { username, email, password } = parsed.data;
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.username, username), eq(users.email, email.toLowerCase())))
        .limit(1);
    if (existing.length) return c.json({ error: "username or email taken" }, 409);

    const passwordHash = await argon2.hash(password);
    const [user] = await db
        .insert(users)
        .values({ username, email: email.toLowerCase(), passwordHash })
        .returning({ id: users.id, username: users.username });

    await startSession(c, user.id);
    return c.json(user, 201);
});

auth.post("/login", async c => {
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);

    const { identifier, password } = parsed.data;
    const [user] = await db
        .select()
        .from(users)
        .where(or(eq(users.username, identifier), eq(users.email, identifier.toLowerCase())))
        .limit(1);

    // same error for unknown user and wrong password
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
        return c.json({ error: "invalid credentials" }, 401);
    }

    await startSession(c, user.id);
    return c.json({ id: user.id, username: user.username });
});

auth.post("/logout", async c => {
    const id = getCookie(c, "session");
    if (id) await db.delete(sessions).where(eq(sessions.id, id));
    deleteCookie(c, "session", { path: "/" });
    return c.json({ ok: true });
});

auth.post("/logout-all", async c => {
    const id = getCookie(c, "session");
    if (id) {
        const [session] = await db
            .select({ userId: sessions.userId })
            .from(sessions)
            .where(eq(sessions.id, id))
            .limit(1);
        if (session) await db.delete(sessions).where(eq(sessions.userId, session.userId));
    }
    deleteCookie(c, "session", { path: "/" });
    return c.json({ ok: true });
});
