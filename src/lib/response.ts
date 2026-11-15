import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type SuccessCode =
    | "auth.register"
    | "auth.login"
    | "auth.logout"
    | "auth.logout_all"
    | "auth.me";

export type ErrorCode =
    | "auth.invalid_input"
    | "auth.identifier_taken"
    | "auth.invalid_credentials"
    | "auth.unauthenticated"
    | "auth.session_expired"
    | "not_found"
    | "http_error"
    | "internal_error";

export type ApiCode = SuccessCode | ErrorCode;

export type ApiSuccess<C extends SuccessCode, T> = {
    success: true;
    code: C;
    data: T;
};

export type ApiFailure<C extends ErrorCode = ErrorCode> = {
    success: false;
    code: C;
    error: {
        message: string;
        details?: unknown;
    };
};

export type ApiEnvelope<T> = ApiSuccess<SuccessCode, T> | ApiFailure;

export function ok<C extends SuccessCode, T>(
    c: Context,
    code: C,
    data: T,
    status: ContentfulStatusCode = 200,
) {
    return c.json(
        {
            success: true,
            code,
            data,
        } satisfies ApiSuccess<C, T>,
        status,
    );
}

export function fail<C extends ErrorCode>(
    c: Context,
    code: C,
    message: string,
    status: ContentfulStatusCode = 400,
    details?: unknown,
) {
    return c.json(
        {
            success: false,
            code,
            error: details === undefined ? { message } : { message, details },
        } satisfies ApiFailure<C>,
        status,
    );
}
