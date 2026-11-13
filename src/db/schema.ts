import { integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
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

export const posts = pgTable("posts", {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
