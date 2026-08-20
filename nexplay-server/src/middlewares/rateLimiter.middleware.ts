import rateLimit from "express-rate-limit";
import { env } from "@/config/env";

/**
 * General API rate limit — applied globally in app.ts.
 * NOTE: uses in-memory store by default. For horizontally-scaled
 * deployments, swap the `store` for a Redis-backed store using the
 * client from `config/redis.ts` (architecture already prepared).
 */
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

/**
 * Stricter limiter for sensitive auth endpoints (login, register,
 * forgot-password) to slow down brute-force and credential-stuffing
 * attempts independently of account lockout.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." },
});
