import { Hono } from "hono";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { createPost, getPost, listPosts } from "../services/posts.js";

export const postsRoute = new Hono();

const createSchema = z.object({
    title: z.string().min(1).max(200),
    blocks: z
        .array(z.object({ type: z.literal("text"), text: z.string().min(1).max(20000) }))
        .min(1)
        .max(50),
});

postsRoute.post("/", requireAuth, async c => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.fail("posts.invalid_input", "invalid input", 400, z.flattenError(parsed.error));
    }

    const post = await createPost(c.get("user").id, parsed.data);
    return c.ok("posts.create", post, 201);
});

postsRoute.get("/", optionalAuth, async c => {
    return c.ok("posts.list", await listPosts(20, c.get("user")?.id));
});

postsRoute.get("/:id", optionalAuth, async c => {
    const id = c.req.param("id");
    if (!z.uuid().safeParse(id).success) return c.fail("posts.not_found", "not found", 404);

    const post = await getPost(id, c.get("user")?.id);
    if (!post) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.get", post);
});
