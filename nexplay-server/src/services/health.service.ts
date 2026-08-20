import { prisma } from "@/config/db";
import { redis, isRedisEnabled } from "@/config/redis";
import { jobQueue } from "@/jobs/queue";
import { env } from "@/config/env";

/**
 * Health service. Probes each subsystem and returns a structured report
 * the monitoring endpoint exposes. Each probe is guarded so one failing
 * dependency doesn't throw — it just reports "down". Overall status is
 * "healthy" only when every *required* dependency is up (Redis is
 * optional, so it reports status but doesn't fail the overall check).
 */
type Status = "up" | "down" | "disabled";

interface Probe {
  status: Status;
  latencyMs?: number;
  detail?: string;
}

async function timed(fn: () => Promise<void>): Promise<Probe> {
  const start = Date.now();
  try {
    await fn();
    return { status: "up", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "down", latencyMs: Date.now() - start, detail: err instanceof Error ? err.message : String(err) };
  }
}

export const healthService = {
  async check() {
    const [database, cache] = await Promise.all([
      // Database probe — a trivial query.
      timed(async () => {
        await prisma.$queryRaw`SELECT 1`;
      }),
      // Redis probe (optional).
      (async (): Promise<Probe> => {
        if (!isRedisEnabled || !redis) return { status: "disabled", detail: "REDIS_URL not set" };
        const client = redis;
        return timed(async () => {
          await client.ping();
        });
      })(),
    ]);

    const queue: Probe = { status: "up", detail: `${jobQueue.pending} pending` };

    // Storage probe — Cloudinary is configured via env; we just report
    // whether credentials are present (a real ping would cost an API call).
    const storage: Probe = env.CLOUDINARY_CLOUD_NAME
      ? { status: "up", detail: "cloudinary configured" }
      : { status: "disabled", detail: "cloudinary not configured" };

    // Overall: healthy if required deps (database) are up.
    const overall = database.status === "up" ? "healthy" : "unhealthy";

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? "unknown",
      environment: env.NODE_ENV,
      checks: { database, cache, queue, storage },
    };
  },

  /** Lightweight liveness probe — is the process up at all. */
  liveness() {
    return { status: "alive", timestamp: new Date().toISOString(), uptime: Math.round(process.uptime()) };
  },
};
