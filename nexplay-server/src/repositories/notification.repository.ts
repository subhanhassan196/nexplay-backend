import { prisma } from "@/config/db";
import type { NotificationType, Prisma } from "@prisma/client";

/**
 * Notification data access. Originally a minimal writer for the game
 * engine (achievement unlocks); now the full module backing the live
 * notification center — list, unread counts, mark-read, delete, plus
 * bulk-create for announcement broadcasts.
 */
export const notificationRepository = {
  // Original signature kept so existing callers (achievement.service) don't change.
  create(userId: string, type: NotificationType, title: string, body?: string, data?: object) {
    return prisma.notification.create({
      data: { userId, type, title, body, data: data as Prisma.InputJsonValue },
    });
  },

  createMany(
    rows: { userId: string; type: NotificationType; title: string; body?: string; data?: Prisma.InputJsonValue }[]
  ) {
    return prisma.notification.createMany({ data: rows });
  },

  listByUser(userId: string, args: { skip: number; take: number; unreadOnly?: boolean }) {
    return prisma.notification.findMany({
      where: { userId, ...(args.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
    });
  },

  countByUser(userId: string, unreadOnly?: boolean) {
    return prisma.notification.count({ where: { userId, ...(unreadOnly ? { isRead: false } : {}) } });
  },

  unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },

  delete(id: string, userId: string) {
    return prisma.notification.deleteMany({ where: { id, userId } });
  },

  deleteAllRead(userId: string) {
    return prisma.notification.deleteMany({ where: { userId, isRead: true } });
  },
};
