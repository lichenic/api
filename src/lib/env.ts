import { z } from "zod";

const schema = z.object({
    PORT: z.string().regex(/^\d+$/).transform(Number).default(3000),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    DATABASE_URL: z.url(),
});

export const env = schema.parse(process.env);
