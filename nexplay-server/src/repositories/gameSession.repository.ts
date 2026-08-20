import { prisma } from "@/config/db";
import type { GameSessionResult, GameSessionStatus } from "@prisma/client";

export const gameSessionRepository = {
  create(data: { userId: string; gameId: string; metadata?: object }) {
    return prisma.gameSession.create({
      data: {
        userId: data.userId,
        gameId: data.gameId,
        metadata: data.metadata,
      },
    });
  },

  findById(id: string) {
    return prisma.gameSession.findUnique({ where: { id } });
  },

  complete(
    id: string,
    data: { status: GameSessionStatus; result?: GameSessionResult; score: number; durationSeconds: number; metadata?: object }
  ) {
    return prisma.gameSession.update({
      where: { id },
      data: {
        status: data.status,
        result: data.result,
        score: data.score,
        durationSeconds: data.durationSeconds,
        metadata: data.metadata,
        endedAt: new Date(),
      },
    });
  },

  findRecentByUser(userId: string, gameId: string, limit = 10) {
    return prisma.gameSession.findMany({
      where: { userId, gameId, status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },
};
