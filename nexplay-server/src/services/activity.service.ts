import { activityRepository } from "@/repositories/activity.repository";
import { buildPaginationMeta, type ListQuery } from "@/utils/apiFeatures";
import type { Prisma } from "@prisma/client";

/**
 * Central activity logger. Every important event routes through
 * `record()` so the admin Activity Center has one consistent stream.
 * Fire-and-forget by design — logging must never break the action it's
 * recording, so failures are swallowed (best-effort audit trail).
 */
export const ACTIVITY_ACTIONS = {
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  USER_REGISTER: "user.register",
  TICKET_CREATED: "ticket.created",
  TICKET_REPLIED: "ticket.replied",
  TICKET_STATE_CHANGED: "ticket.state_changed",
  TICKET_ASSIGNED: "ticket.assigned",
  CONVERSATION_CLOSED: "conversation.closed",
  SETTINGS_CHANGED: "settings.changed",
  ANNOUNCEMENT_PUBLISHED: "announcement.published",
  QUICKLINK_CHANGED: "quicklink.changed",
  GAME_VIEWED: "game.viewed",
  ADMIN_ACTION: "admin.action",
} as const;

export const activityService = {
  async record(params: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
  }) {
    try {
      await activityRepository.log(params);
    } catch {
      /* audit logging is best-effort — never throw into the caller's flow */
    }
  },

  async list(query: ListQuery, filters: { action?: string; entityType?: string; actorId?: string }) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
    };
    const [items, totalItems] = await Promise.all([
      activityRepository.list({ where, skip, take: query.limit }),
      activityRepository.count(where),
    ]);
    return { items, pagination: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }) };
  },
};
