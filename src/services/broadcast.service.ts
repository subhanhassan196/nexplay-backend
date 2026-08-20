import { prisma } from "@/config/db";
import { NotFoundError, ValidationError } from "@/errors";
import { stripHtml } from "@/helpers/sanitize";
import { realtimeEmitter } from "@/services/realtime.service";
import { notificationService } from "@/services/notification.service";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import { logger } from "@/utils/logger";

/**
 * Broadcasts — one support message delivered into many conversations,
 * targeted by customer tag.
 *
 * Each recipient gets a real message in their own thread rather than a
 * shared announcement, so they can reply to it and the agent sees that
 * reply in the normal inbox. Delivery is chunked and failures are
 * tolerated per-recipient: one bad row shouldn't abort a send that has
 * already reached hundreds of people.
 */
const CHUNK_SIZE = 50;

export const broadcastService = {
  list() {
    return prisma.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  },

  /** How many customers a given tag selection would reach. */
  async previewAudience(tagIds: string[]) {
    if (tagIds.length === 0) {
      const count = await prisma.user.count({ where: { deletedAt: null, role: "PLAYER" } });
      return { count, tagIds };
    }

    const rows = await prisma.customerTagAssignment.findMany({
      where: { tagId: { in: tagIds } },
      select: { userId: true },
      distinct: ["userId"],
    });
    return { count: rows.length, tagIds };
  },

  create(data: { title: string; content: string; tagIds?: string[] }) {
    const title = stripHtml(data.title).trim();
    const content = stripHtml(data.content).trim();
    if (!title || !content) throw new ValidationError("Title and message are required.");

    return prisma.broadcast.create({
      data: { title, content, tagIds: data.tagIds ?? [] },
    });
  },

  update(id: string, data: { title?: string; content?: string; tagIds?: string[] }) {
    return prisma.broadcast.update({
      where: { id },
      data: {
        ...(data.title ? { title: stripHtml(data.title).trim() } : {}),
        ...(data.content ? { content: stripHtml(data.content).trim() } : {}),
        ...(data.tagIds ? { tagIds: data.tagIds } : {}),
      },
    });
  },

  async remove(id: string) {
    await prisma.broadcast.delete({ where: { id } });
    return { success: true };
  },

  /**
   * Sends a draft. Marks it SENDING first so a double-click can't send
   * the same broadcast twice, then delivers in chunks.
   */
  async send(id: string, actorId: string) {
    const broadcast = await prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new NotFoundError("Broadcast");
    if (broadcast.status === "SENT") throw new ValidationError("This broadcast has already been sent.");
    if (broadcast.status === "SENDING") throw new ValidationError("This broadcast is already being sent.");

    await prisma.broadcast.update({ where: { id }, data: { status: "SENDING" } });

    try {
      // Resolve the audience.
      let userIds: string[];
      if (broadcast.tagIds.length === 0) {
        const users = await prisma.user.findMany({
          where: { deletedAt: null, role: "PLAYER" },
          select: { id: true },
        });
        userIds = users.map((u: { id: string }) => u.id);
      } else {
        const rows = await prisma.customerTagAssignment.findMany({
          where: { tagId: { in: broadcast.tagIds } },
          select: { userId: true },
          distinct: ["userId"],
        });
        userIds = rows.map((r: { userId: string }) => r.userId);
      }

      let delivered = 0;

      for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
        const chunk = userIds.slice(i, i + CHUNK_SIZE);

        // Settled per recipient: a single failure (deleted account,
        // constraint clash) shouldn't stop the rest of the send.
        const results = await Promise.allSettled(
          chunk.map(async (userId) => {
            const conversation = await prisma.conversation.upsert({
              where: { userId },
              create: { userId },
              update: {},
            });

            const message = await prisma.message.create({
              data: {
                conversationId: conversation.id,
                senderType: "SYSTEM",
                content: broadcast.content,
              },
            });

            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date(), lastMessagePreview: broadcast.content.slice(0, 140) },
            });

            realtimeEmitter.messageCreated(conversation.id, message);
            void notificationService.notify(userId, "ANNOUNCEMENT", broadcast.title, broadcast.content.slice(0, 120), {
              broadcastId: broadcast.id,
            });
          })
        );

        delivered += results.filter((r) => r.status === "fulfilled").length;
      }

      const sent = await prisma.broadcast.update({
        where: { id },
        data: { status: "SENT", sentAt: new Date(), sentById: actorId, recipientCount: delivered },
      });

      void activityService.record({
        actorId,
        action: ACTIVITY_ACTIONS.ADMIN_ACTION,
        entityType: "Broadcast",
        entityId: id,
        metadata: { action: "sent", recipients: delivered, title: broadcast.title },
      });

      logger.info("Broadcast sent", { id, delivered, targeted: userIds.length });
      return sent;
    } catch (err) {
      // Leave it FAILED rather than stuck on SENDING, so it can be retried.
      await prisma.broadcast.update({ where: { id }, data: { status: "FAILED" } });
      throw err;
    }
  },
};
