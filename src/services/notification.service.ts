import { notificationRepository } from "@/repositories/notification.repository";
import { realtimeEmitter } from "@/services/realtime.service";
import { SOCKET_EVENTS } from "@/constants/socketEvents";
import { buildPaginationMeta, type ListQuery } from "@/utils/apiFeatures";
import type { NotificationType, Prisma } from "@prisma/client";

/**
 * Notification service. `notify()` is the single entry point the rest
 * of the app calls to send a notification: it persists the row AND
 * pushes it live over the socket to the recipient's `user:<id>` room,
 * so a bell badge updates instantly with no polling.
 */
export const notificationService = {
  async notify(userId: string, type: NotificationType, title: string, body?: string, data?: object) {
    const notification = await notificationRepository.create(userId, type, title, body, data);
    realtimeEmitter.toUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, { notification });
    return notification;
  },

  /** Broadcast the same notification to many users (e.g. a published announcement). */
  async broadcast(userIds: string[], type: NotificationType, title: string, body?: string, data?: object) {
    if (userIds.length === 0) return { count: 0 };
    const rows = userIds.map((userId) => ({ userId, type, title, body, data }));
    const result = await notificationRepository.createMany(rows);
    // Push to each recipient live.
    for (const userId of userIds) {
      realtimeEmitter.toUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
        notification: { type, title, body, data, isRead: false, createdAt: new Date().toISOString() },
      });
    }
    return result;
  },

  async list(userId: string, query: ListQuery, unreadOnly?: boolean) {
    const skip = (query.page - 1) * query.limit;
    const [items, totalItems, unreadCount] = await Promise.all([
      notificationRepository.listByUser(userId, { skip, take: query.limit, unreadOnly }),
      notificationRepository.countByUser(userId, unreadOnly),
      notificationRepository.unreadCount(userId),
    ]);
    return { items, unreadCount, pagination: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }) };
  },

  getUnreadCount(userId: string) {
    return notificationRepository.unreadCount(userId);
  },

  markRead(userId: string, id: string) {
    return notificationRepository.markRead(id, userId);
  },

  markAllRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  },

  delete(userId: string, id: string) {
    return notificationRepository.delete(id, userId);
  },

  clearRead(userId: string) {
    return notificationRepository.deleteAllRead(userId);
  },
};
