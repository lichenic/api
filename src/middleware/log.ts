import type { MiddlewareHandler } from "hono";
import { log } from "../lib/logger.js";

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const started = Date.now();

  await next();

  log.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - started,
    },
    "request completed",
  );
};
