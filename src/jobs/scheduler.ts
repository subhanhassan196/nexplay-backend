import { prisma } from "@/config/db";
import { logger } from "@/utils/logger";

/**
 * Lightweight interval-based scheduler for recurring maintenance jobs.
 * No external cron dependency — uses setInterval, which is sufficient for
 * housekeeping tasks. Each task is wrapped so one failing task never
 * stops the others. Call `startScheduler()` once at boot.
 */
interface ScheduledTask {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

const HOUR = 60 * 60 * 1000;

const tasks: ScheduledTask[] = [
  {
    name: "cleanup-expired-refresh-tokens",
    intervalMs: 6 * HOUR,
    run: async () => {
      const result = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count) logger.info("Cleaned expired refresh tokens", { count: result.count });
    },
  },
  {
    name: "cleanup-expired-verifications",
    intervalMs: 12 * HOUR,
    run: async () => {
      const result = await prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count) logger.info("Cleaned expired email verifications", { count: result.count });
    },
  },
  {
    name: "cleanup-old-read-notifications",
    intervalMs: 24 * HOUR,
    run: async () => {
      // Remove read notifications older than 30 days to keep the table lean.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const result = await prisma.notification.deleteMany({
        where: { isRead: true, createdAt: { lt: cutoff } },
      });
      if (result.count) logger.info("Cleaned old notifications", { count: result.count });
    },
  },
];

const timers: NodeJS.Timeout[] = [];

export function startScheduler() {
  for (const task of tasks) {
    // Run once shortly after boot, then on the interval.
    const safeRun = async () => {
      try {
        await task.run();
      } catch (err) {
        logger.error("Scheduled task failed", {
          task: task.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    // Stagger initial runs so they don't all fire at boot.
    const initialDelay = 30_000 + Math.random() * 30_000;
    setTimeout(safeRun, initialDelay);

    const timer = setInterval(safeRun, task.intervalMs);
    timers.push(timer);
  }
  logger.info("Scheduler started", { tasks: tasks.length });
}

export function stopScheduler() {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
}
