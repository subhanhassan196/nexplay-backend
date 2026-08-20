import { conversationRepository } from "@/repositories/conversation.repository";
import { prisma } from "@/config/db";
import { messageRepository } from "@/repositories/message.repository";
import {
  quickLinkRepository,
  announcementRepository,
  supportSettingRepository,
} from "@/repositories/supportContent.repository";
import { NotFoundError, ForbiddenError, ValidationError } from "@/errors";
import { buildPaginationMeta, type ListQuery } from "@/utils/apiFeatures";
import { realtimeEmitter } from "@/services/realtime.service";
import { attachmentService } from "@/services/attachment.service";

/// How long after sending a message may still be edited. Kept short so
/// a conversation's history stays trustworthy.
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";

/**
 * User-facing side of the global support messenger. Every read/write
 * resolves the caller's single conversation via `userId` — there is no
 * conversationId in the user-facing API surface, which structurally
 * enforces the "one conversation per user" product rule.
 *
 * No AI/live-agent auto-responder is wired here yet: a user message is
 * persisted and the conversation is surfaced to the admin console. The
 * schema (senderType AGENT/SYSTEM/BOT) is ready for replies to arrive
 * from any of those sources with no further migration.
 */
export const messengerService = {
  /** The default "home" payload shown when the messenger opens: welcome text, quick links, announcements, support status. */
  async getBootstrap() {
    const [quickLinks, announcements, settings] = await Promise.all([
      quickLinkRepository.listActive(),
      announcementRepository.listActive(),
      supportSettingRepository.getAll(),
    ]);

    return {
      welcomeMessage: settings.welcome_message,
      supportHours: settings.support_hours,
      isOnline: settings.is_online === "true",
      offlineMessage: settings.offline_message,
      quickLinks,
      announcements,
    };
  },

  /**
   * The customer's own thread, plus who is handling it. Showing the
   * assigned agent's name and photo makes support feel like a person
   * rather than a queue — but only safe fields are exposed: the customer
   * gets a username and avatar, never an email or role detail.
   */
  async getMyConversation(userId: string) {
    const conversation = await conversationRepository.getOrCreateForUser(userId);
    const unreadCount = await messageRepository.countUnreadForUser(conversation.id, userId);

    let agent: { username: string; avatarUrl: string | null; isOnline: boolean; lastSeenAt: Date | null } | null = null;

    if (conversation.assignedAgentId) {
      const record = await prisma.user.findUnique({
        where: { id: conversation.assignedAgentId },
        select: {
          username: true,
          profile: { select: { avatarUrl: true } },
          sessions: {
            where: { expiresAt: { gte: new Date() } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      if (record) {
        // An unexpired session is a reasonable proxy for "around" without
        // needing a separate presence table for this one field.
        const latest = record.sessions[0];
        agent = {
          username: record.username,
          avatarUrl: record.profile?.avatarUrl ?? null,
          isOnline: Boolean(latest),
          lastSeenAt: latest?.createdAt ?? null,
        };
      }
    }

    return { conversation, unreadCount, agent };
  },

  async getMyMessages(userId: string, query: ListQuery) {
    const conversation = await conversationRepository.getOrCreateForUser(userId);
    const skip = (query.page - 1) * query.limit;

    const [messages, totalItems] = await Promise.all([
      messageRepository.listByConversation(conversation.id, { skip, take: query.limit }),
      messageRepository.countByConversation(conversation.id),
    ]);

    return {
      conversation,
      messages,
      pagination: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  },

  async sendMessage(
    userId: string,
    content: string,
    attachmentUrls?: string[],
    replyToId?: string,
    gameContext?: { slug: string; title: string },
    attachments?: {
      kind: "IMAGE" | "DOCUMENT" | "VOICE";
      url: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      durationSeconds?: number | null;
    }[]
  ) {
    const conversation = await conversationRepository.getOrCreateForUser(userId);

    if (replyToId) {
      const target = await messageRepository.findById(replyToId);
      if (!target || target.conversationId !== conversation.id) {
        throw new ValidationError("You can only reply to a message in this conversation.");
      }
    }

    const message = await messageRepository.create({
      conversationId: conversation.id,
      senderType: "USER",
      senderId: userId,
      content,
      attachmentUrls,
      replyToId,
      gameSlug: gameContext?.slug,
      gameTitle: gameContext?.title,
    });

    // Attachment rows are written after the message exists, so a failed
    // upload can never leave rows pointing at a message that isn't there.
    if (attachments && attachments.length > 0) {
      await attachmentService.createForMessage(message.id, attachments);
    }

    await conversationRepository.touch(conversation.id, content);
    // Remember the most recent game context on the conversation so the
    // admin inbox can show "came from X" without scanning every message.
    if (gameContext) {
      await conversationRepository.update(conversation.id, {
        lastGameSlug: gameContext.slug,
        lastGameTitle: gameContext.title,
      });
    }
    // Reopen the thread if the user writes after it was resolved/archived.
    if (conversation.state !== "OPEN") {
      await conversationRepository.setState(conversation.id, "OPEN");
    }

    realtimeEmitter.messageCreated(conversation.id, message);

    void activityService.record({
      actorId: userId,
      action: ACTIVITY_ACTIONS.TICKET_REPLIED,
      entityType: "Conversation",
      entityId: conversation.id,
      metadata: { by: "user" },
    });

    return message;
  },

  /**
   * Edits a message within a short window after sending.
   *
   * The window is enforced here, not in the UI: hiding the edit button
   * after 15 minutes stops an honest user, but the API has to reject a
   * late edit or someone can rewrite old history with a crafted request.
   */
  async editMyMessage(userId: string, messageId: string, content: string) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError("Message");
    if (message.senderId !== userId) throw new ForbiddenError("You can only edit your own messages.");
    if (message.deletedAt) throw new ValidationError("This message has been deleted.");

    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    if (ageMs > MESSAGE_EDIT_WINDOW_MS) {
      const minutes = Math.round(MESSAGE_EDIT_WINDOW_MS / 60000);
      throw new ValidationError(`Messages can only be edited within ${minutes} minutes of sending.`);
    }
    const updated = await messageRepository.edit(messageId, content);
    realtimeEmitter.messageUpdated(message.conversationId, updated);
    return updated;
  },

  /**
   * Deletes a message for everyone. The original text is copied into
   * MessageAudit first: participants stop seeing it immediately, but an
   * authorised admin can still inspect what was said. Destroying the only
   * copy would make moderation of abuse reports impossible.
   */
  async deleteMyMessage(userId: string, messageId: string) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError("Message");
    if (message.senderId !== userId) throw new ForbiddenError("You can only delete your own messages.");
    // Preserve the original before the soft-delete blanks it out.
    await prisma.messageAudit.upsert({
      where: { messageId },
      create: {
        messageId,
        conversationId: message.conversationId,
        originalContent: message.content,
        attachmentUrls: message.attachmentUrls ?? [],
        deletedById: userId,
        deletedForEveryone: true,
      },
      update: {},
    });

    const deleted = await messageRepository.softDelete(messageId);
    realtimeEmitter.messageUpdated(message.conversationId, deleted);
    return deleted;
  },

  async markRead(userId: string) {
    const conversation = await conversationRepository.getOrCreateForUser(userId);
    const messages = await messageRepository.listByConversation(conversation.id, { skip: 0, take: 500 });
    const unreadFromOthers = messages
      .filter((m: { senderId: string | null }) => m.senderId !== userId)
      .map((m: { id: string }) => m.id);
    if (unreadFromOthers.length > 0) await messageRepository.markRead(unreadFromOthers, userId);
    return { markedRead: unreadFromOthers.length };
  },

  async toggleReaction(userId: string, messageId: string, emoji: string, add: boolean) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError("Message");
    if (add) await messageRepository.addReaction(messageId, userId, emoji);
    else await messageRepository.removeReaction(messageId, userId, emoji);
    const updated = await messageRepository.findById(messageId);
    if (updated) realtimeEmitter.messageUpdated(message.conversationId, updated);
    return updated;
  },
};
