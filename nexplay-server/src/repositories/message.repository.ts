import { prisma } from "@/config/db";
import type { MessageSenderType, Prisma } from "@prisma/client";

const senderSelect = { select: { id: true, username: true, profile: { select: { avatarUrl: true } } } };

const messageInclude = {
  sender: senderSelect,
  replyTo: {
    select: { id: true, content: true, senderType: true, deletedAt: true, sender: senderSelect },
  },
  reactions: { select: { id: true, emoji: true, userId: true } },
} satisfies Prisma.MessageInclude;

type SenderWithProfile = { id: string; username: string; profile: { avatarUrl: string | null } | null } | null;

function flattenSender(sender: SenderWithProfile) {
  if (!sender) return null;
  const { profile, ...rest } = sender;
  return { ...rest, avatarUrl: profile?.avatarUrl ?? null };
}

/** Flattens sender (and replyTo.sender) avatarUrl onto plain fields. */
function flattenMessage<T extends { sender?: SenderWithProfile; replyTo?: { sender: SenderWithProfile } | null } | null>(
  message: T
) {
  if (!message) return message;
  return {
    ...message,
    ...(message.sender !== undefined ? { sender: flattenSender(message.sender) } : {}),
    ...(message.replyTo
      ? { replyTo: { ...message.replyTo, sender: flattenSender(message.replyTo.sender) } }
      : {}),
  };
}

export const messageRepository = {
  async create(data: {
    conversationId: string;
    senderType: MessageSenderType;
    senderId?: string;
    content: string;
    attachmentUrls?: string[];
    replyToId?: string;
    gameSlug?: string;
    gameTitle?: string;
  }) {
    const message = await prisma.message.create({ data, include: messageInclude });
    return flattenMessage(message);
  },

  async findById(id: string) {
    const message = await prisma.message.findUnique({ where: { id }, include: messageInclude });
    return flattenMessage(message);
  },

  async listByConversation(conversationId: string, args: { skip: number; take: number }) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      skip: args.skip,
      take: args.take,
      include: messageInclude,
    });
    return messages.map(flattenMessage);
  },

  countByConversation(conversationId: string) {
    return prisma.message.count({ where: { conversationId } });
  },

  async edit(id: string, content: string) {
    const message = await prisma.message.update({
      where: { id },
      data: { content, editedAt: new Date() },
      include: messageInclude,
    });
    return flattenMessage(message);
  },

  async softDelete(id: string) {
    const message = await prisma.message.update({
      where: { id },
      data: { deletedAt: new Date(), content: "", attachmentUrls: [] },
      include: messageInclude,
    });
    return flattenMessage(message);
  },

  // ── Reactions ──
  addReaction(messageId: string, userId: string, emoji: string) {
    return prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });
  },

  removeReaction(messageId: string, userId: string, emoji: string) {
    return prisma.messageReaction.deleteMany({ where: { messageId, userId, emoji } });
  },

  // ── Read status / unread counts ──
  markRead(messageIds: string[], userId: string) {
    return prisma.$transaction(
      messageIds.map((messageId) =>
        prisma.messageReadStatus.upsert({
          where: { messageId_userId: { messageId, userId } },
          create: { messageId, userId },
          update: {},
        })
      )
    );
  },

  /** Counts messages in a conversation not sent by `userId` and not yet read by them. */
  countUnreadForUser(conversationId: string, userId: string) {
    return prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        deletedAt: null,
        readStatuses: { none: { userId } },
      },
    });
  },
};
