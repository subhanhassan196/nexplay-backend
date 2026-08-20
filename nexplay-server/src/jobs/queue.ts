import { logger } from "@/utils/logger";

/**
 * In-process job queue with retry. Designed so it can be swapped for a
 * Redis/BullMQ-backed queue later without changing call sites: producers
 * call `enqueue()`, handlers are registered by job name. For now jobs run
 * on the same process (fine for a single instance); the interface is the
 * same one a distributed queue would expose.
 */
type JobHandler<T = unknown> = (payload: T) => Promise<void>;

interface QueuedJob {
  id: string;
  name: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

class JobQueue {
  private handlers = new Map<string, JobHandler>();
  private queue: QueuedJob[] = [];
  private processing = false;

  /** Register a handler for a named job type. */
  register<T>(name: string, handler: JobHandler<T>) {
    this.handlers.set(name, handler as JobHandler);
  }

  /** Add a job to the queue; processed asynchronously. */
  enqueue(name: string, payload: unknown, maxAttempts = 3) {
    const job: QueuedJob = {
      id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      payload,
      attempts: 0,
      maxAttempts,
    };
    this.queue.push(job);
    void this.process();
    return job.id;
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      const handler = this.handlers.get(job.name);
      if (!handler) {
        logger.warn("No handler for job", { name: job.name });
        continue;
      }

      job.attempts++;
      try {
        await handler(job.payload);
        logger.debug("Job completed", { name: job.name, id: job.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (job.attempts < job.maxAttempts) {
          // Exponential backoff, then re-queue.
          const delay = Math.min(1000 * 2 ** (job.attempts - 1), 30000);
          logger.warn("Job failed, retrying", { name: job.name, attempt: job.attempts, delay, error: message });
          setTimeout(() => {
            this.queue.push(job);
            void this.process();
          }, delay);
        } else {
          logger.error("Job failed permanently", { name: job.name, attempts: job.attempts, error: message });
        }
      }
    }

    this.processing = false;
  }

  get pending() {
    return this.queue.length;
  }
}

export const jobQueue = new JobQueue();

// ── Job name constants ──
export const JOBS = {
  SEND_EMAIL: "email.send",
  CLEANUP_EXPIRED_TOKENS: "cleanup.expired_tokens",
  CLEANUP_OLD_NOTIFICATIONS: "cleanup.old_notifications",
} as const;
