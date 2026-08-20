import { prisma } from "@/config/db";
import type { ConversationState, Prisma } from "@prisma/client";

// avatarUrl lives on the Profile relation, not User — select it through
// the relation, then flatten it onto the user object so the API/frontend
// see a plain `avatarUrl` field.
const userSelect = {
  select: { id: true, username: true, email: true, profile: { select: { avatarUrl: true } } },
};

type UserWithProfile = { id: string; username: string; email: string; profile: { avatarUrl: string | null } | null };

function flattenUser<T extends UserWithProfile | null>(user: T) {
  if (!user) return null;
  const { profile, ...rest } = user;
  return { ...rest, avatarUrl: profile?.avatarUrl ?? null };
}

/** Flattens the user + assignedAgent relations on a conversation record. */
function flattenConversation<
  T extends { user?: UserWithProfile | null; assignedAgent?: UserWithProfile | null } | null
>(conversation: T) {
  if (!conversation) return conversation;
  return {
    ...conversation,
    ...(conversation.user !== undefined ? { user: flattenUser(conversation.user) } : {}),
    ...(conversation.assignedAgent !== undefined ? { assignedAgent: flattenUser(conversation.assignedAgent) } : {}),
  };
}

export const conversationRepository = {
  /** Gets the user's single conversation, creating it on first access (upsert keeps the "one per user" invariant). */
  getOrCreateForUser(userId: string) {
    return prisma.conversation.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  },

  findByUserId(userId: string) {
    return prisma.conversation.findUnique({ where: { userId } });
  },

  async findById(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { user: userSelect, assignedAgent: userSelect },
    });
    return flattenConversation(conversation);
  },

  touch(id: string, preview: string) {
    return prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), lastMessagePreview: preview.slice(0, 140) },
    });
  },

  // ── Admin console queries ──
  async listForAdmin(args: {
    where: Prisma.ConversationWhereInput;
    skip: number;
    take: number;
    orderBy?: Prisma.ConversationOrderByWithRelationInput[];
  }) {
    const items = await prisma.conversation.findMany({
      where: args.where,
      orderBy: [{ isPinned: "desc" }, ...(args.orderBy ?? [{ lastMessageAt: "desc" }])],
      skip: args.skip,
      take: args.take,
      include: { user: userSelect, assignedAgent: userSelect },
    });
    return items.map(flattenConversation);
  },

  countForAdmin(where: Prisma.ConversationWhereInput) {
    return prisma.conversation.count({ where });
  },

  async update(id: string, data: Prisma.ConversationUpdateInput) {
    const conversation = await prisma.conversation.update({
      where: { id },
      data,
      include: { user: userSelect, assignedAgent: userSelect },
    });
    return flattenConversation(conversation);
  },

  setState(id: string, state: ConversationState) {
    return prisma.conversation.update({ where: { id }, data: { state } });
  },

  delete(id: string) {
    return prisma.conversation.delete({ where: { id } });
  },
};
