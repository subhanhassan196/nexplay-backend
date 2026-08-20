import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { ApiError } from "@/utils/ApiError";
import { isProd } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Must be registered last in app.ts. Normalizes every thrown error
 * (ApiError, Zod, Prisma, or unexpected) into one consistent JSON shape
 * and never leaks stack traces / internals in production.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, { statusCode: err.statusCode });
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File is too large." : `File upload error: ${err.message}`;
    return res.status(400).json({ success: false, message });
  }

  // Error objects don't serialise — their message/stack aren't enumerable,
  // so passing one straight to the logger produced an empty "{}" and told
  // us nothing. Pull the useful fields out explicitly.
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, {
    name: err instanceof Error ? err.name : typeof err,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    // Prisma attaches a code/meta that usually pinpoints the problem.
    code: (err as { code?: string })?.code,
    meta: (err as { meta?: unknown })?.meta,
  });

  return res.status(500).json({
    success: false,
    message: isProd ? "Internal server error" : String(err instanceof Error ? err.message : err),
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
