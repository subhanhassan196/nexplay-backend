import { conversationRepository } from "@/repositories/conversation.repository";
import { prisma } from "@/config/db";
import { attachmentService } from "@/services/attachment.service";
import { messageRepository } from "@/repositories/message.repository";
import {
  quickLinkRepository,
  announcementRepository,
  supportSettingRepository,
} from "@/repositories/supportContent.repository";
import { NotFoundError } from "@/errors";
import { buildPaginationMeta, type ListQuery } from "@/utils/apiFeatures";
import { realtimeEmitter } from "@/services/realtime.service";
import { notificationService } from "@/services/notification.service";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import type { ConversationState, Prisma, QuickLinkCategory } from "@prisma/client";

/**
 * Agent/admin side of the support messenger. Guarded by requireRole
 * (MODERATOR+) at the route layer. An agent reply is just a Message
 * with senderType AGENT — same table, same shape as user messages.
 */
export const adminSupportService = {
  async listConversations(
    query: ListQuery,
    filters: {
      state?: ConversationState;
      assignedAgentId?: string;
      search?: string;
      priority?: string;
      assignment?: "assigned" | "unassigned";
      sort?: "newest" | "oldest" | "priority" | "waiting";
    }
  ) {
    const skip = (query.page - 1) * query.limit;

    const where: Prisma.ConversationWhereInput = {
      ...(filters.state ? { state: filters.state } : {}),
      ...(filters.assignedAgentId ? { assignedAgentId: filters.assignedAgentId } : {}),
      ...(filters.priority ? { priority: filters.priority as Prisma.ConversationWhereInput["priority"] } : {}),
      ...(filters.assignment === "assigned" ? { assignedAgentId: { not: null } } : {}),
      ...(filters.assignment === "unassigned" ? { assignedAgentId: null } : {}),
      ...(filters.search
        ? {
            user: {
              OR: [
                { username: { contains: filters.search, mode: "insensitive" } },
                { email: { contains: filters.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    // Queue ordering. Pinned always floats to the top (handled in repo);
    // this controls the secondary sort within that.
    const orderBy: Prisma.ConversationOrderByWithRelationInput[] =
      filters.sort === "oldest"
        ? [{ lastMessageAt: "asc" }]
        : filters.sort === "priority"
          ? [{ priority: "desc" }, { lastMessageAt: "desc" }]
          : filters.sort === "waiting"
            ? [{ state: "asc" }, { lastMessageAt: "asc" }] // OPEN first, longest-waiting first
            : [{ lastMessageAt: "desc" }]; // newest (default)

    const [items, totalItems] = await Promise.all([
      conversationRepository.listForAdmin({ where, skip, take: query.limit, orderBy }),
      conversationRepository.countForAdmin(where),
    ]);

    return { items, pagination: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }) };
  },

  /** Bulk apply a state change to many conversations at once. */
  async bulkSetState(conversationIds: string[], state: ConversationState) {
    await prisma.conversation.updateMany({
      where: { id: { in: conversationIds } },
      data: {
        state,
        ...(state === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        ...(state === "ARCHIVED" ? { closedAt: new Date() } : {}),
      },
    });
    return { count: conversationIds.length };
  },

  async bulkAssign(conversationIds: string[], agentId: string | null) {
    await prisma.conversation.updateMany({
      where: { id: { in: conversationIds } },
      data: { assignedAgentId: agentId },
    });
    return { count: conversationIds.length };
  },

  async getConversation(conversationId: string, query: ListQuery) {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError("Conversation");

    const skip = (query.page - 1) * query.limit;
    const [messages, totalItems] = await Promise.all([
      messageRepository.listByConversation(conversationId, { skip, take: query.limit }),
      messageRepository.countByConversation(conversationId),
    ]);

    return { conversation, messages, pagination: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }) };
  },

  async reply(
    agentId: string,
    conversationId: string,
    content: string,
    attachmentUrls?: string[],
    attachments?: {
      kind: "IMAGE" | "DOCUMENT" | "VOICE";
      url: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      durationSeconds?: number | null;
    }[]
  ) {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError("Conversation");

    const message = await messageRepository.create({
      conversationId,
      senderType: "AGENT",
      senderId: agentId,
      content,
      attachmentUrls,
    });

    // Agents get the same attachment capability as customers — a support
    // reply is often more useful as a screenshot or a voice note.
    if (attachments && attachments.length > 0) {
      await attachmentService.createForMessage(message.id, attachments);
    }

    await conversationRepository.touch(conversationId, content);
    realtimeEmitter.messageCreated(conversationId, message, false);

    // Notify the ticket owner that support replied.
    void notificationService.notify(
      conversation.user.id,
      "SUPPORT_REPLY",
      "Support replied to your message",
      content.slice(0, 120),
      { conversationId }
    );
    void activityService.record({
      actorId: agentId,
      action: ACTIVITY_ACTIONS.TICKET_REPLIED,
      entityType: "Conversation",
      entityId: conversationId,
      metadata: { by: "agent" },
    });

    return message;
  },

  async listAgents() {
    return prisma.user.findMany({
      where: { role: { in: ["MODERATOR", "ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
      select: { id: true, username: true, email: true, role: true },
      orderBy: { username: "asc" },
    });
  },

  async setState(conversationId: string, state: ConversationState) {
    const extra: Prisma.ConversationUpdateInput = {};
    if (state === "RESOLVED") extra.resolvedAt = new Date();
    if (state === "ARCHIVED") extra.closedAt = new Date();
    const conversation = await conversationRepository.update(conversationId, { state, ...extra });
    realtimeEmitter.conversationUpdated(conversation);
    return conversation;
  },

  async assign(conversationId: string, agentId: string | null) {
    const conversation = await conversationRepository.update(conversationId, {
      assignedAgent: agentId ? { connect: { id: agentId } } : { disconnect: true },
    });
    realtimeEmitter.conversationUpdated(conversation);
    return conversation;
  },

  async setPinned(conversationId: string, isPinned: boolean) {
    const conversation = await conversationRepository.update(conversationId, { isPinned });
    realtimeEmitter.conversationUpdated(conversation);
    return conversation;
  },

  /** Update ticket metadata: priority, category, tags, resolution notes. */
  async updateTicket(
    conversationId: string,
    data: { priority?: string; category?: string; tags?: string[]; resolutionNotes?: string }
  ) {
    const conversation = await conversationRepository.update(conversationId, {
      priority: data.priority as Prisma.ConversationUpdateInput["priority"],
      category: data.category as Prisma.ConversationUpdateInput["category"],
      tags: data.tags,
      resolutionNotes: data.resolutionNotes,
    });
    realtimeEmitter.conversationUpdated(conversation);
    return conversation;
  },

  deleteConversation(conversationId: string) {
    return conversationRepository.delete(conversationId);
  },

  // ── Content administration ──
  quickLinks: {
    list: () => quickLinkRepository.listAll(),
    create: (data: { category: QuickLinkCategory; label: string; url: string; iconName?: string; description?: string; order?: number }) =>
      quickLinkRepository.create(data),
    update: (id: string, data: Prisma.QuickLinkUpdateInput) => quickLinkRepository.update(id, data),
    remove: (id: string) => quickLinkRepository.delete(id),
  },

  announcements: {
    list: () => announcementRepository.listAll(),
    create: async (data: { title: string; body: string; expiresAt?: Date }) => {
      const announcement = await announcementRepository.create(data);
      // Broadcast a notification to every active user.
      const users = await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true } });
      void notificationService.broadcast(
        users.map((u: { id: string }) => u.id),
        "ANNOUNCEMENT",
        data.title,
        data.body,
        { announcementId: announcement.id }
      );
      void activityService.record({
        action: ACTIVITY_ACTIONS.ANNOUNCEMENT_PUBLISHED,
        entityType: "Announcement",
        entityId: announcement.id,
        metadata: { title: data.title },
      });
      return announcement;
    },
    update: (id: string, data: Prisma.AnnouncementUpdateInput) => announcementRepository.update(id, data),
    remove: (id: string) => announcementRepository.delete(id),
  },

  settings: {
    getAll: () => supportSettingRepository.getAll(),
    async update(key: string, value: string, updatedById?: string) {
      const result = await supportSettingRepository.upsert(key, value, updatedById);

      // Push the change out so every open messenger updates its status
      // dot live rather than waiting for a refresh.
      const all = await supportSettingRepository.getAll();
      realtimeEmitter.supportSettingsChanged({
        isOnline: all.is_online === "true",
        supportHours: all.support_hours,
        offlineMessage: all.offline_message,
      });

      void activityService.record({
        actorId: updatedById,
        action: ACTIVITY_ACTIONS.SETTINGS_CHANGED,
        entityType: "SupportSetting",
        entityId: key,
        metadata: { key, value },
      });

      return result;
    },
  },
};
