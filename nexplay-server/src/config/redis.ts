import Redis from "ioredis";
import { env } from "@/config/env";

/**
 * Redis client — ARCHITECTURE PREPARED FOR PHASE 4+.
 *
 * Phase 3 auth does not require Redis to function (refresh token
 * rotation is done via Postgres in `token.service.ts`). This client is
 * wired up now so future phases can drop in usages without re-plumbing
 * config:
 *   - Session/presence cache for Socket.IO (Phase 4 real-time features)
 *   - Rate-limit store shared across horizontally scaled instances
 *   - Short-lived OTP / verification code cache
 *   - Leaderboard cache (Phase 4+ gameplay features)
 *
 * If REDIS_URL is not set, `redis` will be null and callers should
 * fall back gracefully (see `isRedisEnabled`).
 */
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      retryStrategy: () => null, // don't keep retrying if Redis isn't reachable — it's optional
    })
  : null;

// ioredis logs a noisy "Unhandled error event" warning for every
// connection error if nothing is listening on 'error'. We handle it
// ourselves (silently, at debug level) since a missing/unreachable
// Redis is an expected, non-fatal state in local dev — see
// `isRedisEnabled` for how callers should check before using it.
redis?.on("error", () => {
  /* connection errors are surfaced once via connectRedis() below */
});

export const isRedisEnabled = Boolean(redis);

export async function connectRedis() {
  if (!redis) {
    console.warn("⚠️  REDIS_URL not set — Redis-backed features are disabled for this run.");
    return;
  }
  try {
    await redis.connect();
    console.log("✅ Redis connected");
  } catch {
    console.warn("⚠️  Redis is not reachable — continuing without it (this is fine for local dev).");
    redis.disconnect(); // stop further reconnection attempts
  }
}
