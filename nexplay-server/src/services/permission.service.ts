import { prisma } from "@/config/db";
import { cacheService } from "@/services/cache.service";
import { ROLE_PERMISSIONS, SUPER_ADMIN_ONLY, type Permission } from "@/constants/permissions";
import type { Role } from "@prisma/client";

/**
 * Resolves what a user is actually allowed to do.
 *
 * Effective set = role baseline, plus explicit grants, minus explicit
 * denies. A handful of capabilities are reserved for SUPER_ADMIN and are
 * stripped for anyone else even if a row grants them — that stops a
 * privilege-escalation path where an admin grants themselves role
 * management and then promotes their own account.
 *
 * Results are cached briefly and busted whenever permissions change.
 */
const CACHE_TTL = 300;

function cacheKey(userId: string) {
  return `perms:${userId}`;
}

export const permissionService = {
  async getEffectivePermissions(userId: string, role: Role): Promise<Set<Permission>> {
    const cached = await cacheService.get<Permission[]>(cacheKey(userId));
    if (cached) return new Set(cached);

    const overrides = await prisma.userPermission.findMany({
      where: { userId },
      select: { permission: true, granted: true },
    });

    const effective = new Set<Permission>(ROLE_PERMISSIONS[role] ?? []);

    for (const o of overrides) {
      if (o.granted) effective.add(o.permission as Permission);
      else effective.delete(o.permission as Permission);
    }

    // Reserved capabilities can never land on a non-super-admin.
    if (role !== "SUPER_ADMIN") {
      for (const reserved of SUPER_ADMIN_ONLY) effective.delete(reserved);
    }

    await cacheService.set(cacheKey(userId), Array.from(effective), CACHE_TTL);
    return effective;
  },

  async has(userId: string, role: Role, permission: Permission): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId, role);
    return effective.has(permission);
  },

  /** Grants or denies a capability for one user. */
  async setPermission(userId: string, permission: Permission, granted: boolean, grantedById?: string) {
    const row = await prisma.userPermission.upsert({
      where: { userId_permission: { userId, permission } },
      create: { userId, permission, granted, grantedById },
      update: { granted, grantedById },
    });
    await cacheService.del(cacheKey(userId));
    return row;
  },

  /** Removes an override, falling the user back to their role baseline. */
  async clearPermission(userId: string, permission: Permission) {
    await prisma.userPermission.deleteMany({ where: { userId, permission } });
    await cacheService.del(cacheKey(userId));
  },

  async listOverrides(userId: string) {
    return prisma.userPermission.findMany({ where: { userId }, orderBy: { permission: "asc" } });
  },

  /** Call after any role change so stale permissions aren't served. */
  async invalidate(userId: string) {
    await cacheService.del(cacheKey(userId));
  },
};
