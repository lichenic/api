import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "#db";
import { interactions, postBlocks, posts, users, type InteractionType } from "#db/schema.js";

export type PostBlockInput = {
    type: "text";
    text: string;
};

export type CreatePostInput = {
    title: string;
    blocks: PostBlockInput[];
    replyToId?: string | null;
};

export type PostCounts = {
    likes: number;
    reposts: number;
    replies: number;
};

export type PostViewer = {
    liked: boolean;
    reposted: boolean;
    hidden: boolean;
};

export type PostSummary = {
    id: string;
    title: string;
    createdAt: Date;
    author: string;
    replyToId: string | null;
    counts: PostCounts;
    viewer: PostViewer | null;
};

export type PostDetail = PostSummary & {
    blocks: {
        type: "text";
        content: unknown;
    }[];
};

type PostRow = {
    id: string;
    title: string;
    createdAt: Date;
    author: string;
    replyToId: string | null;
    likeCount: number;
    repostCount: number;
    replyCount: number;
    liked: boolean;
    reposted: boolean;
    hidden: boolean;
};

const replyCount = sql<number>`(
    select count(*)::int
    from ${posts} as "reply_posts"
    where "reply_posts"."reply_to_id" = ${posts.id}
)`;

function interactionCount(type: InteractionType) {
    return sql<number>`(
        select count(*)::int
        from ${interactions}
        where ${interactions.postId} = ${posts.id}
        and ${interactions.type} = ${type}
    )`;
}

function viewerHasInteraction(viewerId: string | undefined, type: InteractionType) {
    if (!viewerId) return sql<boolean>`false`;

    return sql<boolean>`exists (
        select 1
        from ${interactions}
        where ${interactions.postId} = ${posts.id}
        and ${interactions.userId} = ${viewerId}
        and ${interactions.type} = ${type}
    )`;
}

function notHidden(viewerId: string) {
    return sql<boolean>`not exists (
        select 1
        from ${interactions}
        where ${interactions.postId} = ${posts.id}
        and ${interactions.userId} = ${viewerId}
        and ${interactions.type} = 'hide'
    )`;
}

function postFields(viewerId?: string) {
    return {
        id: posts.id,
        title: posts.title,
        createdAt: posts.createdAt,
        author: users.username,
        replyToId: posts.replyToId,
        likeCount: interactionCount("like"),
        repostCount: interactionCount("repost"),
        replyCount,
        liked: viewerHasInteraction(viewerId, "like"),
        reposted: viewerHasInteraction(viewerId, "repost"),
        hidden: viewerHasInteraction(viewerId, "hide"),
    };
}

function toPostSummary(row: PostRow, viewerId?: string): PostSummary {
    const { likeCount, repostCount, replyCount, liked, reposted, hidden, ...post } = row;

    return {
        ...post,
        counts: {
            likes: likeCount,
            reposts: repostCount,
            replies: replyCount,
        },
        viewer: viewerId ? { liked, reposted, hidden } : null,
    };
}

export async function createPost(authorId: string, input: CreatePostInput) {
    return db.transaction(async tx => {
        const [post] = await tx
            .insert(posts)
            .values({ authorId, title: input.title, replyToId: input.replyToId ?? null })
            .returning({
                id: posts.id,
                title: posts.title,
                replyToId: posts.replyToId,
                createdAt: posts.createdAt,
            });

        await tx.insert(postBlocks).values(
            input.blocks.map((block, position) => ({
                postId: post.id,
                position,
                type: block.type,
                content: { text: block.text },
            })),
        );

        return post;
    });
}

export async function createReply(authorId: string, postId: string, input: Omit<CreatePostInput, "replyToId">) {
    const [parent] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!parent) return null;

    return createPost(authorId, { ...input, replyToId: postId });
}

export async function listPosts(limit = 20, viewerId?: string): Promise<PostSummary[]> {
    const rows = await db
        .select(postFields(viewerId))
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(viewerId ? notHidden(viewerId) : undefined)
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(limit);

    return rows.map(row => toPostSummary(row, viewerId));
}

export async function listReplies(postId: string, viewerId?: string, limit = 20): Promise<PostSummary[] | null> {
    const [parent] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!parent) return null;

    const rows = await db
        .select(postFields(viewerId))
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(eq(posts.replyToId, postId))
        .orderBy(asc(posts.createdAt), asc(posts.id))
        .limit(limit);

    return rows.map(row => toPostSummary(row, viewerId));
}

export async function getPost(id: string, viewerId?: string): Promise<PostDetail | null> {
    const [row] = await db
        .select(postFields(viewerId))
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(eq(posts.id, id))
        .limit(1);

    if (!row) return null;

    const blocks = await db
        .select({
            type: postBlocks.type,
            content: postBlocks.content,
        })
        .from(postBlocks)
        .where(eq(postBlocks.postId, id))
        .orderBy(asc(postBlocks.position));

    return { ...toPostSummary(row, viewerId), blocks };
}
