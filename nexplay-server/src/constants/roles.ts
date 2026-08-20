import type { Role } from "@prisma/client";

/**
 * Central role hierarchy reference. `ROLE_HIERARCHY` gives each role a
 * numeric rank so future authorization checks can do "at least
 * Moderator" comparisons instead of listing every role explicitly.
 * No admin routes/UI are implemented in Phase 4 — this exists purely
 * so `requireRole()` (auth.middleware.ts) and future modules share one
 * source of truth.
 */
export const ROLES = {
  PLAYER: "PLAYER",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const satisfies Record<string, Role>;

// Ranks are additive: each level can do everything below it.
export const ROLE_HIERARCHY: Record<Role, number> = {
  PLAYER: 0,
  SUPPORT_AGENT: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasMinimumRole(role: Role, minimum: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimum];
}
