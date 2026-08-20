import { jobQueue, JOBS } from "@/jobs/queue";
import { emailService } from "@/services/email.service";
import { logger } from "@/utils/logger";

/**
 * Registers all background job handlers. Called once at boot. Keeping
 * registration in one place makes it easy to see every async job the
 * system runs. Producers enqueue via `jobQueue.enqueue(JOBS.X, payload)`.
 */
interface EmailJobPayload {
  type: "verification" | "passwordReset" | "accountLocked";
  to: string;
  username: string;
  url: string;
}

export function registerJobHandlers() {
  jobQueue.register<EmailJobPayload>(JOBS.SEND_EMAIL, async (payload) => {
    switch (payload.type) {
      case "verification":
        await emailService.sendVerificationEmail(payload.to, payload.username, payload.url);
        break;
      case "passwordReset":
        await emailService.sendPasswordResetEmail(payload.to, payload.username, payload.url);
        break;
      case "accountLocked":
        await emailService.sendAccountLockedEmail(payload.to, payload.username, payload.url);
        break;
    }
  });

  logger.info("Job handlers registered");
}
