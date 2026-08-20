import { redis, isRedisEnabled } from "@/config/redis";

/**
 * Cache service. Uses Redis when available, otherwise falls back to an
 * in-process Map so caching "just works" in local dev without Redis.
 *
 * Callers should treat the cache as a best-effort optimization — a miss
 * or a down cache never breaks the request, it just recomputes. Keys are
 * namespaced by convention: "entity:id" or "list:entity:hash".
 */

// In-memory fallback with per-key expiry (used only when Redis is off).
const memStore = new Map<string, { value: string; expiresAt: number }>();

function memGet(key: string): string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: string, ttlSeconds: number) {
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export const cacheService = {
  /** Get + JSON-parse a cached value, or null on miss. */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = isRedisEnabled && redis ? await redis.get(key) : memGet(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  /** JSON-serialize + store with a TTL (default 5 minutes). */
  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (isRedisEnabled && redis) await redis.set(key, raw, "EX", ttlSeconds);
      else memSet(key, raw, ttlSeconds);
    } catch {
      /* cache write failures are non-fatal */
    }
  },

  /** Delete one key. */
  async del(key: string): Promise<void> {
    try {
      if (isRedisEnabled && redis) await redis.del(key);
      else memStore.delete(key);
    } catch {
      /* ignore */
    }
  },

  /** Invalidate every key matching a prefix (e.g. "games:"). */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      if (isRedisEnabled && redis) {
        const keys = await redis.keys(`${prefix}*`);
        if (keys.length) await redis.del(...keys);
      } else {
        for (const key of memStore.keys()) {
          if (key.startsWith(prefix)) memStore.delete(key);
        }
      }
    } catch {
      /* ignore */
    }
  },

  /**
   * Cache-aside helper: return the cached value, or run `producer`,
   * cache its result, and return it. The single method most call sites
   * should use.
   */
  async remember<T>(key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await producer();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },
};
