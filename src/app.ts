import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { log } from "./lib/logger.js";
import { fail } from "./lib/response.js";
import { requestLogger } from "./middleware/log.js";
import { responseHelpers } from "./middleware/response.js";
import { auth } from "./routes/auth.js";

export const app = new Hono();

app.use("*", responseHelpers);
app.use("*", requestLogger);

app.get("/", c => c.text("lichenic server is running!"));
app.get("/health", c => c.json({ ok: true }));

app.route("/auth", auth);

app.notFound(c => fail(c, "not_found", "route not found", 404));

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return fail(c, "http_error", err.message || "request failed", err.status);
    }

    log.error(
        {
            err,
            method: c.req.method,
            path: c.req.path,
        },
        "unhandled error",
    );

    return fail(c, "internal_error", "internal server error", 500);
});
