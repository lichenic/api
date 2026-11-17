import { asc, desc, eq } from "drizzle-orm";
import { db } from "#db";
import { postBlocks, posts, users } from "#db/schema.js";

export type PostBlockInput = {
    type: "text";
    text: string;
};

export type CreatePostInput = {
    title: string;
    blocks: PostBlockInput[];
};

export type PostSummary = {
    id: string;
    title: string;
    createdAt: Date;
    author: string;
};

export type PostDetail = PostSummary & {
    blocks: {
        type: "text";
        content: unknown;
    }[];
};

export async function createPost(authorId: string, input: CreatePostInput) {
    return db.transaction(async tx => {
        const [post] = await tx
            .insert(posts)
            .values({ authorId, title: input.title })
            .returning({
                id: posts.id,
                title: posts.title,
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

export async function listPosts(limit = 20): Promise<PostSummary[]> {
    return db
        .select({
            id: posts.id,
            title: posts.title,
            createdAt: posts.createdAt,
            author: users.username,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(limit);
}

export async function getPost(id: string): Promise<PostDetail | null> {
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

    if (!post) return null;

    const blocks = await db
        .select({
            type: postBlocks.type,
            content: postBlocks.content,
        })
        .from(postBlocks)
        .where(eq(postBlocks.postId, id))
        .orderBy(asc(postBlocks.position));

    return { ...post, blocks };
}
