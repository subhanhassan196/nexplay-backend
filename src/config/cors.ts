import type { CorsOptions } from "cors";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";

/**
 * Allows the configured CLIENT_URL plus any local-network origin, so the
 * app works on localhost, over a LAN IP (phone/second laptop on the same
 * Wi-Fi), and from the deployed frontend.
 *
 * Extra origins can be listed in CORS_EXTRA_ORIGINS as a comma-separated
 * string — useful for preview deployments without a redeploy.
 */
export const LAN_ORIGIN =
  /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;

/** Trailing slashes are a classic silent mismatch — normalise them away. */
function normalise(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

const allowList = new Set(
  [env.CLIENT_URL, ...(process.env.CORS_EXTRA_ORIGINS ?? "").split(",")].map(normalise).filter(Boolean)
);

export function isOriginAllowed(origin: string): boolean {
  const clean = normalise(origin);
  if (allowList.has(clean)) return true;
  if (LAN_ORIGIN.test(clean)) return true;
  // Vercel preview builds get a new subdomain per deploy; allow them only
  // when the production frontend is itself a vercel.app host.
  if (clean.endsWith(".vercel.app") && [...allowList].some((a) => a.endsWith(".vercel.app"))) return true;
  return false;
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No origin (same-origin, curl, mobile app) → allow.
    if (!origin) return callback(null, true);

    if (isOriginAllowed(origin)) return callback(null, true);

    // Deliberately NOT an error. Passing an Error here propagates into the
    // error handler and surfaces as a 500 "Internal server error", which is
    // both wrong and very hard to diagnose. Returning `false` just omits
    // the CORS header — the browser blocks the request, which is the
    // correct, honest behaviour.
    logger.warn("Blocked cross-origin request", { origin, allowed: [...allowList] });
    return callback(null, false);
  },
  credentials: true, // required so the browser sends/receives httpOnly cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
