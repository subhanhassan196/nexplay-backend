import type { Role } from "@prisma/client";

/**
 * The full capability catalogue. Every protected admin action maps to
 * one of these keys, so authorization is a lookup rather than a pile of
 * role comparisons scattered through the codebase.
 */
export const PERMISSIONS = {
  // Users
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",

  // Games & catalog
  GAMES_READ: "games.read",
  GAMES_CREATE: "games.create",
  GAMES_UPDATE: "games.update",
  GAMES_DELETE: "games.delete",

  // Tournaments
  TOURNAMENTS_READ: "tournaments.read",
  TOURNAMENTS_CREATE: "tournaments.create",
  TOURNAMENTS_UPDATE: "tournaments.update",
  TOURNAMENTS_DELETE: "tournaments.delete",

  // Rewards, wheel, store
  REWARDS_READ: "rewards.read",
  REWARDS_CREATE: "rewards.create",
  REWARDS_UPDATE: "rewards.update",
  REWARDS_DELETE: "rewards.delete",

  // Support chat
  CHAT_READ: "chat.read",
  CHAT_REPLY: "chat.reply",
  CHAT_MANAGE: "chat.manage",

  // CMS content
  CONTENT_READ: "content.read",
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_DELETE: "content.delete",

  // Platform administration
  ADMIN_MANAGE: "admin.manage",
  ROLES_MANAGE: "roles.manage",
  PERMISSIONS_MANAGE: "permissions.manage",
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
  AUDIT_READ: "audit.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL: Permission[] = Object.values(PERMISSIONS);

/**
 * Role baselines. A user's effective permissions are this set, adjusted
 * by any explicit per-user grants or denies in UserPermission.
 *
 * The ladder is deliberately additive: each level can do everything the
 * level below it can, plus more.
 */
const SUPPORT_AGENT: Permission[] = [
  PERMISSIONS.CHAT_READ,
  PERMISSIONS.CHAT_REPLY,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.GAMES_READ,
  PERMISSIONS.TOURNAMENTS_READ,
];

const MODERATOR: Permission[] = [
  ...SUPPORT_AGENT,
  PERMISSIONS.CHAT_MANAGE,
  PERMISSIONS.GAMES_CREATE,
  PERMISSIONS.GAMES_UPDATE,
  PERMISSIONS.CONTENT_READ,
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_UPDATE,
  PERMISSIONS.TOURNAMENTS_CREATE,
  PERMISSIONS.TOURNAMENTS_UPDATE,
  PERMISSIONS.REWARDS_READ,
];

const ADMIN: Permission[] = [
  ...MODERATOR,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.GAMES_DELETE,
  PERMISSIONS.CONTENT_DELETE,
  PERMISSIONS.TOURNAMENTS_DELETE,
  PERMISSIONS.REWARDS_CREATE,
  PERMISSIONS.REWARDS_UPDATE,
  PERMISSIONS.REWARDS_DELETE,
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.SETTINGS_UPDATE,
  PERMISSIONS.AUDIT_READ,
];

// Super admin holds everything, including the account/role management
// capabilities that no other level can be granted.
const SUPER_ADMIN: Permission[] = ALL;

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  PLAYER: [],
  SUPPORT_AGENT,
  MODERATOR,
  ADMIN,
  SUPER_ADMIN,
};

/** Capabilities only a SUPER_ADMIN may ever hold, even via an override. */
export const SUPER_ADMIN_ONLY: Permission[] = [
  PERMISSIONS.ADMIN_MANAGE,
  PERMISSIONS.ROLES_MANAGE,
  PERMISSIONS.PERMISSIONS_MANAGE,
  PERMISSIONS.USERS_DELETE,
];

/** Numeric rank used to stop an admin from acting on someone senior. */
export const ROLE_RANK: Record<Role, number> = {
  PLAYER: 0,
  SUPPORT_AGENT: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};
