import { prisma } from "@/config/db";

export const achievementRepository = {
  findBySlug(slug: string) {
    return prisma.achievement.findUnique({ where: { slug } });
  },

  hasUnlocked(userId: string, achievementId: string) {
    return prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId } },
    });
  },

  unlock(userId: string, achievementId: string) {
    return prisma.userAchievement.create({ data: { userId, achievementId } });
  },
};

export const xpHistoryRepository = {
  record(userId: string, amount: number, reason: string, metadata?: object) {
    return prisma.xPHistory.create({ data: { userId, amount, reason, metadata } });
  },

  getTotalXP(userId: string) {
    return prisma.xPHistory.aggregate({ where: { userId }, _sum: { amount: true } });
  },
};

export const recentlyPlayedRepository = {
  async recordPlay(userId: string, gameId: string) {
    return prisma.recentlyPlayed.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: { userId, gameId, playCount: 1, lastPlayedAt: new Date() },
      update: { playCount: { increment: 1 }, lastPlayedAt: new Date() },
    });
  },

  findByUser(userId: string, limit = 10) {
    return prisma.recentlyPlayed.findMany({
      where: { userId },
      orderBy: { lastPlayedAt: "desc" },
      take: limit,
      include: { game: true },
    });
  },
};
