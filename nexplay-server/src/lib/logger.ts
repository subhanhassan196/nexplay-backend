import fs from "fs";
import path from "path";
import { isProd } from "@/config/env";

/**
 * Minimal dependency-free structured logger. Writes to both the
 * console (human-readable, colorized in dev) and rotating-by-day files
 * under `logs/` (app-YYYY-MM-DD.log, error-YYYY-MM-DD.log) so
 * production incidents can be traced without an external log
 * aggregator wired up yet — swap the `writeToFile` transport for one
 * later (e.g. Winston + CloudWatch/Datadog) without touching call sites.
 */

const LOG_DIR = path.join(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

type LogLevel = "info" | "warn" | "error" | "debug";

const colors: Record<LogLevel, string> = {
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  debug: "\x1b[90m", // gray
};
const RESET = "\x1b[0m";

function todayFile(prefix: string) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `${prefix}-${date}.log`);
}

function writeToFile(file: string, line: string) {
  fs.appendFile(file, line + "\n", (err) => {
    if (err) console.error("Logger file write failed:", err);
  });
}

function format(level: LogLevel, message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();
  const metaStr = meta !== undefined ? ` ${typeof meta === "string" ? meta : JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

function log(level: LogLevel, message: string, meta?: unknown) {
  const line = format(level, message, meta);

  if (!isProd) {
    console.log(`${colors[level]}${line}${RESET}`);
  } else if (level !== "debug") {
    console.log(line);
  }

  writeToFile(todayFile("app"), line);
  if (level === "error") writeToFile(todayFile("error"), line);
}

export const logger = {
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
  debug: (message: string, meta?: unknown) => {
    if (!isProd) log("debug", message, meta);
  },
  /** Adapter so Morgan can pipe HTTP access logs through the same transport. */
  stream: {
    write: (message: string) => log("info", message.trim()),
  },
};
