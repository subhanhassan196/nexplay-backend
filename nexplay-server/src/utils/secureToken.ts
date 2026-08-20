import crypto from "crypto";

/**
 * Generates a cryptographically secure random token for email
 * verification / password reset links, and its SHA-256 hash for
 * storage. Only the hash is persisted — the raw token is emailed to
 * the user once and never stored, so a leaked database dump alone
 * cannot be used to reset accounts.
 */
export function generateSecureToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
