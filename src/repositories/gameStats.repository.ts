import { prisma } from "@/config/db";
import type { GameSessionResult } from "@prisma/client";

export const gameStatsRepository = {
  findByUserAndGame(userId: string, gameId: string) {
    return prisma.userGameStats.findUnique({ where: { userId_gameId: { userId, gameId } } });
  },

  /**
   * Atomically increments the denormalized aggregate after a session
   * completes. `highScore` isn't expressible as a single-query "max"
   * increment in Prisma, so this reads-then-writes — acceptable since
   * it's called once per session-end (low frequency), not a hot path.
   */
  async recordSessionResult(params: {
    userId: string;
    gameId: string;
    result?: GameSessionResult;
    score: number;
    durationSeconds: number;
  }) {
    const { userId, gameId, result, score, durationSeconds } = params;
    const existing = await prisma.userGameStats.findUnique({ where: { userId_gameId: { userId, gameId } } });

    const highScore = Math.max(existing?.highScore ?? 0, score);
    const isNewHighScore = score > (existing?.highScore ?? 0);

    const updated = await prisma.userGameStats.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: {
        userId,
        gameId,
        gamesPlayed: 1,
        wins: result === "WIN" ? 1 : 0,
        losses: result === "LOSS" ? 1 : 0,
        draws: result === "DRAW" ? 1 : 0,
        highScore,
        totalScore: score,
        totalPlaytimeSeconds: durationSeconds,
        lastPlayedAt: new Date(),
      },
      update: {
        gamesPlayed: { increment: 1 },
        wins: { increment: result === "WIN" ? 1 : 0 },
        losses: { increment: result === "LOSS" ? 1 : 0 },
        draws: { increment: result === "DRAW" ? 1 : 0 },
        highScore,
        totalScore: { increment: score },
        totalPlaytimeSeconds: { increment: durationSeconds },
        lastPlayedAt: new Date(),
      },
    });

    return { stats: updated, isNewHighScore };
  },
};
