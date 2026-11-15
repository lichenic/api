import type { Context, Env, Input } from "hono";
import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
    fail,
    ok,
    type ErrorCode,
    type SuccessCode,
} from "../lib/response.js";

type ResponseHelpers = {
    ok<C extends SuccessCode, T>(
        code: C,
        data: T,
        status?: ContentfulStatusCode,
    ): ReturnType<typeof ok<C, T>>;
    fail<C extends ErrorCode>(
        code: C,
        message: string,
        status?: ContentfulStatusCode,
        details?: unknown,
    ): ReturnType<typeof fail<C>>;
};

declare module "hono" {
    interface Context<
        E extends Env = any,
        P extends string = any,
        I extends Input = {},
    > extends ResponseHelpers {}
}

// hono doesnt have something for adding custom methods, so we just add them using middleware!
export const responseHelpers = createMiddleware(async (c, next) => {
    c.ok = (code, data, status = 200) => ok(c, code, data, status);
    c.fail = (code, message, status, details) => fail(c, code, message, status, details);
    await next();
});
