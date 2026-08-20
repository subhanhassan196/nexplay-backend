import { PrismaClient } from "@prisma/client";
import { isProd } from "@/config/env";

/**
 * Singleton Prisma client. In dev, Node's module cache doesn't survive
 * tsx watch reloads cleanly, so we stash the instance on globalThis to
 * avoid exhausting the Postgres connection pool on every file save.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["error", "warn"] : ["error", "warn"],
  });

if (!isProd) globalForPrisma.prisma = prisma;
