import { users } from "#db/schema.js";

export type User = typeof users.$inferSelect;

export type PublicUser = Pick<User, "id" | "username" | "createdAt">;

export function toPublicUser(user: User | PublicUser): PublicUser {
    return {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
    };
}
