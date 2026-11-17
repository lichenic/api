import { Hono } from "hono";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import {
    hidePost,
    likePost,
    repostPost,
    unhidePost,
    unlikePost,
    unrepostPost,
} from "../services/interactions.js";
import { createReply, listReplies } from "../services/posts.js";

export const interactionsRoute = new Hono();

const replySchema = z.object({
    title: z.string().min(1).max(200),
    blocks: z
        .array(z.object({ type: z.literal("text"), text: z.string().min(1).max(20000) }))
        .min(1)
        .max(50),
});

const isUuid = (value: string) => z.uuid().safeParse(value).success;

interactionsRoute.get("/:id/replies", optionalAuth, async c => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.fail("posts.not_found", "not found", 404);

    const replies = await listReplies(id, c.get("user")?.id);
    if (!replies) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.replies", replies);
});

interactionsRoute.post("/:id/replies", requireAuth, async c => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.fail("posts.not_found", "not found", 404);

    const parsed = replySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.fail("posts.invalid_input", "invalid input", 400, z.flattenError(parsed.error));
    }

    const reply = await createReply(c.get("user").id, id, parsed.data);
    if (!reply) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.reply", reply, 201);
});

interactionsRoute.post("/:id/like", requireAuth, async c => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.fail("posts.not_found", "not found", 404);

    const result = await likePost(id, c.get("user").id);
    if (!result) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.like", result);
});

interactionsRoute.delete("/:id/like", requireAuth, async c => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.fail("posts.not_found", "not found", 404);

    const result = await unlikePost(id, c.get("user").id);
    if (!result) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.unlike", result);
});

interactionsRoute.post("/:id/repost", requireAuth, async c => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.fail("posts.not_found", "not found", 404);

    const result = await repostPost(id, c.get("user").id);
    if (!result) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.repost", result);
});

interactionsRoute.delete("/:id/repost", requireAuth, async c => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.fail("posts.not_found", "not found", 404);

    const result = await unrepostPost(id, c.get("user").id);
    if (!result) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.unrepost", result);
});

interactionsRoute.post("/:id/hide", requireAuth, async c => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.fail("posts.not_found", "not found", 404);

    const result = await hidePost(id, c.get("user").id);
    if (!result) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.hide", result);
});

interactionsRoute.delete("/:id/hide", requireAuth, async c => {
    const id = c.req.param("id");
    if (!isUuid(id)) return c.fail("posts.not_found", "not found", 404);

    const result = await unhidePost(id, c.get("user").id);
    if (!result) return c.fail("posts.not_found", "not found", 404);

    return c.ok("posts.unhide", result);
});
