import { env } from "@/config/env";

/**
 * Lightweight structured logger. In development it prints readable,
 * colored lines; in production it emits single-line JSON so log
 * aggregators (Datadog, CloudWatch, etc.) can parse it. No external
 * dependency — keeps the footprint small while giving consistent,
 * leveled logging across the app.
 */
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: LogLevel = env.NODE_ENV === "production" ? "info" : "debug";

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();

  if (env.NODE_ENV === "production") {
    // Structured JSON for machine parsing.
    console[level === "debug" ? "log" : level](JSON.stringify({ timestamp, level, message, ...meta }));
  } else {
    // Human-readable for local dev.
    const color = COLORS[level];
    const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    console[level === "debug" ? "log" : level](`${color}[${level.toUpperCase()}]${RESET} ${message}${metaStr}`);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
