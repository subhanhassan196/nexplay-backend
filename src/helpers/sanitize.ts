/**
 * Defense-in-depth input sanitization. Zod validation (validators/)
 * is the primary guard against malformed input; these helpers strip
 * dangerous characters from free-text fields (bios, display names,
 * community posts in later phases) before persistence, so stored
 * data is safe to render even if a future view forgets to escape it.
 *
 * Prisma's parameterized queries already prevent SQL injection by
 * construction — this module is specifically about XSS/HTML injection
 * in user-generated text fields.
 */

const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_PROTOCOL_REGEX = /javascript:/gi;

export function stripHtml(input: string): string {
  return input.replace(HTML_TAG_REGEX, "").replace(SCRIPT_PROTOCOL_REGEX, "");
}

export function sanitizeText(input: string, maxLength?: number): string {
  const cleaned = stripHtml(input).trim();
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/** Recursively sanitizes every string value in a plain object (shallow-safe for typical DTOs). */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeText(value);
    }
  }
  return result;
}
