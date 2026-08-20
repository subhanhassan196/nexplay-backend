import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "@/utils/ApiError";

/**
 * Validates `{ body, query, params }` against a Zod schema and
 * replaces `req.body` with the parsed (and coerced/defaulted) result.
 * Sanitizes and rejects malformed input before it reaches a controller.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return next(ApiError.badRequest("Validation failed", fieldErrors));
    }

    req.body = (result.data as { body?: unknown }).body ?? req.body;
    next();
  };
}
