import { conversationRepository } from "@/repositories/conversation.repository";
import { messageRepository } from "@/repositories/message.repository";
import {
  quickLinkRepository,
  announcementRepository,
  supportSettingRepository,
} from "@/repositories/supportContent.repository";
import { NotFoundError, ForbiddenError, ValidationError } from "@/errors";
import { buildPaginationMeta, type ListQuery } from "@/utils/apiFeatures";
import { realtimeEmitter } from "@/services/realtime.service";
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

  async getMyConversation(userId: string) {
    const conversation = await conversationRepository.getOrCreateForUser(userId);
    const unreadCount = await messageRepository.countUnreadForUser(conversation.id, userId);
    return { conversation, unreadCount };
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
    gameContext?: { slug: string; title: string }
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

  async editMyMessage(userId: string, messageId: string, content: string) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError("Message");
    if (message.senderId !== userId) throw new ForbiddenError("You can only edit your own messages.");
    if (message.deletedAt) throw new ValidationError("This message has been deleted.");
    const updated = await messageRepository.edit(messageId, content);
    realtimeEmitter.messageUpdated(message.conversationId, updated);
    return updated;
  },

  async deleteMyMessage(userId: string, messageId: string) {
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError("Message");
    if (message.senderId !== userId) throw new ForbiddenError("You can only delete your own messages.");
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
