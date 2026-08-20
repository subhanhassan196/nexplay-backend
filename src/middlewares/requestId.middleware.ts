import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Attaches a unique `requestId` to every request (and echoes it back
 * as an `X-Request-Id` response header). Once the logger is upgraded
 * to structured JSON output, this is the field that ties together
 * "request came in" → "service did X" → "response sent" log lines,
 * which matters a lot once traffic is high enough that logs interleave.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  req.requestId = incoming ?? crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
