import { prisma } from "@/config/db";

/**
 * Cross-entity search for the admin global search bar. Each entity is
 * queried in parallel with a small cap so results stay snappy. Returns
 * a flat, typed result set the UI can group by `type`.
 */
export const searchService = {
  async globalSearch(query: string, limit = 5) {
    const q = query.trim();
    if (q.length < 2) return { users: [], tickets: [], messages: [], games: [], announcements: [] };

    const [users, tickets, messages, games, announcements] = await Promise.all([
      prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, username: true, email: true, role: true },
        take: limit,
      }),

      // Tickets: match by ticket number (if numeric) or owner username.
      prisma.conversation.findMany({
        where: {
          OR: [
            ...(/^\d+$/.test(q) ? [{ ticketNumber: parseInt(q, 10) }] : []),
            { user: { username: { contains: q, mode: "insensitive" } } },
            { subject: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          ticketNumber: true,
          state: true,
          priority: true,
          user: { select: { username: true } },
        },
        take: limit,
      }),

      prisma.message.findMany({
        where: { content: { contains: q, mode: "insensitive" }, deletedAt: null },
        select: {
          id: true,
          content: true,
          conversationId: true,
          senderType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      prisma.game.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, slug: true, title: true, coverImageUrl: true },
        take: limit,
      }),

      prisma.announcement.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, title: true, body: true, isActive: true },
        take: limit,
      }),
    ]);

    return { users, tickets, messages, games, announcements };
  },
};
