import morgan from "morgan";
import { isProd } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * HTTP access logging. Uses Morgan's formatter but pipes output through
 * our own `logger` (console + file) instead of writing straight to
 * stdout, so access logs land in the same `logs/app-*.log` files as
 * application logs and can be swapped to a real log shipper in one place.
 */
export const requestLogger = morgan(isProd ? "combined" : "dev", {
  stream: logger.stream,
});
