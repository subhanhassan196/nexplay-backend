import { prisma } from "@/config/db";
import { cacheService } from "@/services/cache.service";

/**
 * Leaderboard service. Rankings are derived from real recorded data —
 * UserGameStats for per-game scores and XpHistory for global standing.
 * There are no seeded "demo players": if nobody has played yet, the
 * board is legitimately empty and the UI shows an empty state.
 *
 * Results are cached briefly since ranking queries are read-heavy and
 * the ordering doesn't need to be second-accurate.
 */
const CACHE_TTL = 60; // seconds

interface RankedUser {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  score: number;
  gamesPlayed: number;
  wins: number;
}

function shapeRows(
  rows: {
    userId: string;
    username: string;
    avatarUrl: string | null;
    score: number;
    gamesPlayed: number;
    wins: number;
  }[]
): RankedUser[] {
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

export const leaderboardService = {
  /**
   * Global board — total score across every game, all time.
   * Uses groupBy on UserGameStats so it reflects actual play.
   */
  async global(limit = 50, gameId?: string) {
    return cacheService.remember(`leaderboard:global:${gameId ?? "all"}:${limit}`, CACHE_TTL, async () => {
      const grouped = await prisma.userGameStats.groupBy({
        by: ["userId"],
        where: gameId ? { gameId } : {},
        _sum: { totalScore: true, gamesPlayed: true, wins: true },
        orderBy: { _sum: { totalScore: "desc" } },
        take: limit,
      });

      if (grouped.length === 0) return [];

      const users = await prisma.user.findMany({
        where: { id: { in: grouped.map((g: { userId: string }) => g.userId) }, deletedAt: null },
        select: { id: true, username: true, profile: { select: { avatarUrl: true } } },
      });
      const byId = new Map(users.map((u: { id: string }) => [u.id, u]));

      const rows = grouped
        .map((g: { userId: string; _sum: { totalScore: number | null; gamesPlayed: number | null; wins: number | null } }) => {
          const user = byId.get(g.userId) as
            | { id: string; username: string; profile: { avatarUrl: string | null } | null }
            | undefined;
          if (!user) return null;
          return {
            userId: user.id,
            username: user.username,
            avatarUrl: user.profile?.avatarUrl ?? null,
            score: g._sum.totalScore ?? 0,
            gamesPlayed: g._sum.gamesPlayed ?? 0,
            wins: g._sum.wins ?? 0,
          };
        })
        .filter(Boolean) as RankedUser[];

      return shapeRows(rows);
    });
  },

  /**
   * Weekly board — XP earned in the last 7 days. XpHistory is the only
   * table with reliable per-event timestamps, so it drives "this week".
   */
  async weekly(limit = 50) {
    return cacheService.remember(`leaderboard:weekly:${limit}`, CACHE_TTL, async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const grouped = await prisma.xPHistory.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: since } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: limit,
      });

      if (grouped.length === 0) return [];

      const users = await prisma.user.findMany({
        where: { id: { in: grouped.map((g: { userId: string }) => g.userId) }, deletedAt: null },
        select: { id: true, username: true, profile: { select: { avatarUrl: true } } },
      });
      const byId = new Map(users.map((u: { id: string }) => [u.id, u]));

      const rows = grouped
        .map((g: { userId: string; _sum: { amount: number | null } }) => {
          const user = byId.get(g.userId) as
            | { id: string; username: string; profile: { avatarUrl: string | null } | null }
            | undefined;
          if (!user) return null;
          return {
            userId: user.id,
            username: user.username,
            avatarUrl: user.profile?.avatarUrl ?? null,
            score: g._sum.amount ?? 0,
            gamesPlayed: 0,
            wins: 0,
          };
        })
        .filter(Boolean) as RankedUser[];

      return shapeRows(rows);
    });
  },

  /** Friends board — same scoring as global, scoped to accepted friends. */
  async friends(userId: string, limit = 50) {
    const friendships = await prisma.friend.findMany({
      where: { userId },
      select: { friendId: true },
    });
    const ids = [userId, ...friendships.map((f: { friendId: string }) => f.friendId)];
    if (ids.length === 0) return [];

    const grouped = await prisma.userGameStats.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _sum: { totalScore: true, gamesPlayed: true, wins: true },
      orderBy: { _sum: { totalScore: "desc" } },
      take: limit,
    });

    if (grouped.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g: { userId: string }) => g.userId) } },
      select: { id: true, username: true, profile: { select: { avatarUrl: true } } },
    });
    const byId = new Map(users.map((u: { id: string }) => [u.id, u]));

    const rows = grouped
      .map((g: { userId: string; _sum: { totalScore: number | null; gamesPlayed: number | null; wins: number | null } }) => {
        const user = byId.get(g.userId) as
          | { id: string; username: string; profile: { avatarUrl: string | null } | null }
          | undefined;
        if (!user) return null;
        return {
          userId: user.id,
          username: user.username,
          avatarUrl: user.profile?.avatarUrl ?? null,
          score: g._sum.totalScore ?? 0,
          gamesPlayed: g._sum.gamesPlayed ?? 0,
          wins: g._sum.wins ?? 0,
        };
      })
      .filter(Boolean) as RankedUser[];

    return shapeRows(rows);
  },
};
