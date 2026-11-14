import argon2 from "argon2";
import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "#db";
import { sessions, users } from "#db/schema.js";
import {
    getBearerToken,
    requireSession,
    type SessionVariables,
} from "#api/services/auth.js";
import { toPublicUser } from "#api/services/user.js";

export const auth = new Hono<{ Variables: SessionVariables }>();

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

async function startSession(userId: string) {
    const id = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await db.insert(sessions).values({ id, userId, expiresAt });
    return id;
}

auth.post("/register", async c => {
    const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.fail(
            "auth.invalid_input",
            "invalid input",
            400,
            z.flattenError(parsed.error),
        );
    }

    const { username, email, password } = parsed.data;
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.username, username), eq(users.email, email.toLowerCase())))
        .limit(1);
    if (existing.length) return c.fail("auth.identifier_taken", "username or email taken", 409);

    const passwordHash = await argon2.hash(password);
    const [user] = await db
        .insert(users)
        .values({ username, email: email.toLowerCase(), passwordHash })
        .returning();

    const token = await startSession(user.id);
    return c.ok("auth.register", { ...toPublicUser(user), token }, 201);
});

auth.post("/login", async c => {
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.fail(
            "auth.invalid_input",
            "invalid input",
            400,
            z.flattenError(parsed.error),
        );
    }

    const { identifier, password } = parsed.data;
    const [user] = await db
        .select()
        .from(users)
        .where(or(eq(users.username, identifier), eq(users.email, identifier.toLowerCase())))
        .limit(1);

    // same error for unknown user and wrong password
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
        return c.fail("auth.invalid_credentials", "invalid credentials", 401);
    }

    const token = await startSession(user.id);
    return c.ok("auth.login", { ...toPublicUser(user), token });
});

auth.post("/logout", async c => {
    const id = getBearerToken(c);
    if (id) await db.delete(sessions).where(eq(sessions.id, id));
    return c.ok("auth.logout", null);
});

auth.post("/logout-all", requireSession, async c => {
    const { userId } = c.get("session");
    await db.delete(sessions).where(eq(sessions.userId, userId));
    return c.ok("auth.logout_all", null);
});

auth.get("/me", requireSession, async c => {
    return c.ok("auth.me", c.get("session").user);
});