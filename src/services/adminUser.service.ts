import { prisma } from "@/config/db";
import { NotFoundError, ValidationError } from "@/errors";
import { permissionService } from "@/services/permission.service";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import { ROLE_RANK, ROLE_PERMISSIONS, PERMISSIONS, type Permission } from "@/constants/permissions";
import type { Role } from "@prisma/client";

/**
 * Admin account management.
 *
 * Two rules are enforced here regardless of what the client sends:
 *  1. You can never act on someone at or above your own rank — that
 *     blocks an admin demoting a super admin or deleting a peer.
 *  2. You can never promote someone to a rank at or above your own,
 *     which is the classic privilege-escalation path.
 */
const STAFF_ROLES: Role[] = ["SUPPORT_AGENT", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

function assertCanActOn(actorRole: Role, targetRole: Role) {
  if (ROLE_RANK[targetRole] >= ROLE_RANK[actorRole]) {
    throw new ValidationError("You cannot modify an account at or above your own level.");
  }
}

export const adminUserService = {
  /** Paginated user directory for the admin panel. */
  async listUsers(filters: { search?: string; role?: Role; staffOnly?: boolean; skip?: number; take?: number }) {
    const where = {
      deletedAt: null,
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.staffOnly ? { role: { in: STAFF_ROLES } } : {}),
      ...(filters.search
        ? {
            OR: [
              { username: { contains: filters.search, mode: "insensitive" as const } },
              { email: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          accountStatus: true,
          isEmailVerified: true,
          createdAt: true,
          profile: { select: { avatarUrl: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Flatten avatarUrl the same way the rest of the API does.
    return {
      items: items.map((u: { profile: { avatarUrl: string | null } | null }) => {
        const { profile, ...rest } = u as never as Record<string, unknown> & {
          profile: { avatarUrl: string | null } | null;
        };
        return { ...rest, avatarUrl: profile?.avatarUrl ?? null };
      }),
      total,
    };
  },

  /** Changes a user's role, with both escalation guards applied. */
  async setRole(actorId: string, actorRole: Role, targetUserId: string, newRole: Role) {
    if (actorId === targetUserId) throw new ValidationError("You cannot change your own role.");

    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true, username: true } });
    if (!target) throw new NotFoundError("User");

    assertCanActOn(actorRole, target.role);
    if (ROLE_RANK[newRole] >= ROLE_RANK[actorRole]) {
      throw new ValidationError("You cannot promote a user to your own level or above.");
    }

    const updated = await prisma.user.update({ where: { id: targetUserId }, data: { role: newRole } });
    await permissionService.invalidate(targetUserId);

    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "User",
      entityId: targetUserId,
      metadata: { action: "role_changed", from: target.role, to: newRole, username: target.username },
    });

    return { id: updated.id, username: updated.username, role: updated.role };
  },

  async setAccountStatus(actorId: string, actorRole: Role, targetUserId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED") {
    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, username: true } });
    if (!target) throw new NotFoundError("User");
    assertCanActOn(actorRole, target.role);

    const updated = await prisma.user.update({ where: { id: targetUserId }, data: { accountStatus: status } });

    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "User",
      entityId: targetUserId,
      metadata: { action: "status_changed", to: status, username: target.username },
    });

    return { id: updated.id, accountStatus: updated.accountStatus };
  },

  /** Effective permissions plus which came from overrides. */
  async getUserPermissions(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new NotFoundError("User");

    const [effective, overrides] = await Promise.all([
      permissionService.getEffectivePermissions(userId, user.role),
      permissionService.listOverrides(userId),
    ]);

    return {
      role: user.role,
      baseline: ROLE_PERMISSIONS[user.role] ?? [],
      effective: Array.from(effective),
      overrides,
      catalogue: Object.values(PERMISSIONS),
    };
  },

  async setPermission(actorId: string, actorRole: Role, targetUserId: string, permission: Permission, granted: boolean) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, username: true } });
    if (!target) throw new NotFoundError("User");
    assertCanActOn(actorRole, target.role);

    const row = await permissionService.setPermission(targetUserId, permission, granted, actorId);

    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "UserPermission",
      entityId: targetUserId,
      metadata: { action: granted ? "permission_granted" : "permission_denied", permission, username: target.username },
    });

    return row;
  },

  async clearPermission(actorId: string, actorRole: Role, targetUserId: string, permission: Permission) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
    if (!target) throw new NotFoundError("User");
    assertCanActOn(actorRole, target.role);

    await permissionService.clearPermission(targetUserId, permission);
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "UserPermission",
      entityId: targetUserId,
      metadata: { action: "permission_reset", permission },
    });
    return { success: true };
  },
};
