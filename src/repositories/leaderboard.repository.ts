import { prisma } from "@/config/db";

export const leaderboardRepository = {
  /** Finds the single all-time, platform leaderboard for a game (created by the seed script). */
  findAllTimeByGameId(gameId: string) {
    return prisma.leaderboard.findFirst({ where: { gameId, season: null, isActive: true } });
  },

  async getTopEntries(leaderboardId: string, limit: number) {
    return prisma.leaderboardEntry.findMany({
      where: { leaderboardId },
      orderBy: { score: "desc" },
      take: limit,
      include: { user: { select: { username: true } } },
    });
  },

  async getUserEntry(leaderboardId: string, userId: string) {
    return prisma.leaderboardEntry.findUnique({ where: { leaderboardId_userId: { leaderboardId, userId } } });
  },

  /** Upserts a user's score, keeping the higher of the existing/new score. */
  async submitScoreIfHigher(leaderboardId: string, userId: string, score: number) {
    const existing = await prisma.leaderboardEntry.findUnique({
      where: { leaderboardId_userId: { leaderboardId, userId } },
    });

    if (existing && existing.score >= BigInt(score)) return existing;

    return prisma.leaderboardEntry.upsert({
      where: { leaderboardId_userId: { leaderboardId, userId } },
      create: { leaderboardId, userId, score: BigInt(score) },
      update: { score: BigInt(score) },
    });
  },
};
