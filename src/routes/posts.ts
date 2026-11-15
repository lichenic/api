import { db } from "#db";
import { postBlocks, posts, users } from "#db/schema.js";
import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";

export const postsRoute = new Hono<{
    Variables: { user: { id: string; username: string }; authVia: "session" | "token" };
}>();

const createSchema = z.object({
    title: z.string().min(1).max(200),
    blocks: z
        .array(z.object({ type: z.literal("text"), text: z.string().min(1).max(20000) }))
        .min(1)
        .max(50),
});

postsRoute.post("/", requireAuth, async c => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);

    const { id: authorId } = c.get("user");
    const { title, blocks } = parsed.data;

    const post = await db.transaction(async tx => {
        const [p] = await tx.insert(posts).values({ authorId, title }).returning({ id: posts.id });
        await tx.insert(postBlocks).values(
            blocks.map((b, i) => ({
                postId: p.id,
                position: i,
                type: b.type,
                content: { text: b.text },
            })),
        );
        return p;
    });
    return c.json(post, 201);
});

postsRoute.get("/", async c => {
    const rows = await db
        .select({
            id: posts.id,
            title: posts.title,
            createdAt: posts.createdAt,
            author: users.username,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .orderBy(desc(posts.createdAt))
        .limit(20);
    return c.json(rows);
});

postsRoute.get("/:id", async c => {
    const id = c.req.param("id");
    if (!z.uuid().safeParse(id).success) return c.json({ error: "not found" }, 404);

    const [post] = await db
        .select({
            id: posts.id,
            title: posts.title,
            createdAt: posts.createdAt,
            author: users.username,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(eq(posts.id, id))
        .limit(1);
    if (!post) return c.json({ error: "not found" }, 404);

    const blocks = await db
        .select({ type: postBlocks.type, content: postBlocks.content })
        .from(postBlocks)
        .where(eq(postBlocks.postId, id))
        .orderBy(asc(postBlocks.position));

    return c.json({ ...post, blocks });
});
