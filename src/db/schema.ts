import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    email: text("email").unique(),
    passwordHash: text("password_hash"),
    isBot: boolean("is_bot").notNull().default(false),
    ownerId: uuid("owner_id").references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(), // random token stored in the cookie
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable(
    "posts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        authorId: uuid("author_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        replyToId: uuid("reply_to_id").references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    t => [
        index("posts_created_at_id_idx").on(t.createdAt, t.id),
        index("posts_reply_to_id_idx").on(t.replyToId),
    ],
);

export const interactionTypes = ["like", "repost", "hide"] as const;
export type InteractionType = (typeof interactionTypes)[number];

export const interactions = pgTable(
    "interactions",
    {
        postId: uuid("post_id")
            .notNull()
            .references(() => posts.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        type: text("type").$type<InteractionType>().notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    t => [
        primaryKey({ columns: [t.postId, t.userId, t.type] }),
        index("interactions_post_id_type_idx").on(t.postId, t.type),
        index("interactions_user_id_type_idx").on(t.userId, t.type),
    ],
);

export const postBlocks = pgTable(
    "post_blocks",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        postId: uuid("post_id")
            .notNull()
            .references(() => posts.id, { onDelete: "cascade" }),
        position: integer("position").notNull(),
        type: text("type").$type<"text">().notNull(), // just "text" for now
        content: jsonb("content").notNull(), // { text: "..." }
    },
    t => [unique().on(t.postId, t.position)],
);

export const apiTokens = pgTable("api_tokens", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(), // to tell tokens apart
    expiresAt: timestamp("expires_at", { withTimezone: true }), // null = never expires
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
