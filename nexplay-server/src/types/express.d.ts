import type { Role } from "@prisma/client";

/**
 * Consolidated Express type augmentation. Any middleware that attaches
 * data to `req` (auth.middleware.ts, and future modules) should extend
 * this file rather than declaring `global` blocks in scattered places.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; sessionId: string };
      requestId?: string;
    }
  }
}

export {};
