import { db } from "#db";
import { interactions, posts, type InteractionType } from "#db/schema.js";
import { and, count, eq } from "drizzle-orm";

export type LikeResult = { liked: boolean; likeCount: number };
export type RepostResult = { reposted: boolean; repostCount: number };
export type HideResult = { hidden: boolean };

async function postExists(postId: string) {
    const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
    return Boolean(post);
}

async function addInteraction(postId: string, userId: string, type: InteractionType) {
    if (!(await postExists(postId))) return false;

    await db.insert(interactions).values({ postId, userId, type }).onConflictDoNothing();
    return true;
}

async function removeInteraction(postId: string, userId: string, type: InteractionType) {
    if (!(await postExists(postId))) return false;

    await db
        .delete(interactions)
        .where(
            and(
                eq(interactions.postId, postId),
                eq(interactions.userId, userId),
                eq(interactions.type, type),
            ),
        );
    return true;
}

async function countInteractions(postId: string, type: InteractionType) {
    const [row] = await db
        .select({ count: count() })
        .from(interactions)
        .where(and(eq(interactions.postId, postId), eq(interactions.type, type)));

    return row.count;
}

export async function likePost(postId: string, userId: string): Promise<LikeResult | null> {
    if (!(await addInteraction(postId, userId, "like"))) return null;

    return { liked: true, likeCount: await countInteractions(postId, "like") };
}

export async function unlikePost(postId: string, userId: string): Promise<LikeResult | null> {
    if (!(await removeInteraction(postId, userId, "like"))) return null;

    return { liked: false, likeCount: await countInteractions(postId, "like") };
}

export async function repostPost(postId: string, userId: string): Promise<RepostResult | null> {
    if (!(await addInteraction(postId, userId, "repost"))) return null;

    return { reposted: true, repostCount: await countInteractions(postId, "repost") };
}

export async function unrepostPost(postId: string, userId: string): Promise<RepostResult | null> {
    if (!(await removeInteraction(postId, userId, "repost"))) return null;

    return { reposted: false, repostCount: await countInteractions(postId, "repost") };
}

export async function hidePost(postId: string, userId: string): Promise<HideResult | null> {
    if (!(await addInteraction(postId, userId, "hide"))) return null;

    return { hidden: true };
}

export async function unhidePost(postId: string, userId: string): Promise<HideResult | null> {
    if (!(await removeInteraction(postId, userId, "hide"))) return null;

    return { hidden: false };
}
