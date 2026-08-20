import { gameRepository } from "@/repositories/game.repository";
import { gameSessionRepository } from "@/repositories/gameSession.repository";
import { gameStatsRepository } from "@/repositories/gameStats.repository";
import { leaderboardRepository } from "@/repositories/leaderboard.repository";
import { recentlyPlayedRepository } from "@/repositories/gameEngine.repository";
import { xpService } from "@/services/xp.service";
import { achievementService } from "@/services/achievement.service";
import { NotFoundError, ValidationError } from "@/errors";
import { GAME_SLUGS, XP_REWARDS, ACHIEVEMENTS } from "@/constants/gameEngine";
import type { GameSessionResult } from "@prisma/client";
import type { EndSessionInput, StartSessionInput } from "@/validators/gameSession.validator";

/**
 * Per-game achievement rules for the three Batch 1 games. Kept as a
 * lookup table (not a switch sprawled through the main flow) so adding
 * game #4 in a future batch means adding one entry here, not editing
 * the orchestration logic below.
 */
async function checkAchievements(params: {
  gameSlug: string;
  userId: string;
  result?: GameSessionResult;
  score: number;
  stats: { wins: number };
}) {
  const { gameSlug, userId, result, score, stats } = params;

  if (gameSlug === GAME_SLUGS.TIC_TAC_TOE && result === "WIN") {
    if (stats.wins === 1) await achievementService.unlockIfEligible(userId, ACHIEVEMENTS.TIC_TAC_TOE.FIRST_WIN);
    if (stats.wins === 5) await achievementService.unlockIfEligible(userId, ACHIEVEMENTS.TIC_TAC_TOE.FIVE_WINS);
  }

  if (gameSlug === GAME_SLUGS.CONNECT_FOUR && result === "WIN") {
    if (stats.wins === 1) await achievementService.unlockIfEligible(userId, ACHIEVEMENTS.CONNECT_FOUR.FIRST_WIN);
    if (stats.wins === 5) await achievementService.unlockIfEligible(userId, ACHIEVEMENTS.CONNECT_FOUR.FIVE_WINS);
  }

  if (gameSlug === GAME_SLUGS.SNAKE) {
    if (score >= 1000) await achievementService.unlockIfEligible(userId, ACHIEVEMENTS.SNAKE.SCORE_1000);
    else if (score >= 500) await achievementService.unlockIfEligible(userId, ACHIEVEMENTS.SNAKE.SCORE_500);
    else if (score >= 100) await achievementService.unlockIfEligible(userId, ACHIEVEMENTS.SNAKE.SCORE_100);
  }
}

function xpForResult(result: GameSessionResult | undefined): number {
  if (result === "WIN") return XP_REWARDS.WIN;
  if (result === "DRAW") return XP_REWARDS.DRAW;
  if (result === "LOSS") return XP_REWARDS.LOSS;
  return 0; // score-based games with no win/loss concept (e.g. Snake) rely on base + high-score bonus only
}

export const gameSessionService = {
  async start(userId: string, gameSlug: string, input: StartSessionInput) {
    const game = await gameRepository.findBySlug(gameSlug);
    if (!game) throw new NotFoundError("Game");

    const session = await gameSessionRepository.create({
      userId,
      gameId: game.id,
      metadata: input.metadata,
    });

    await recentlyPlayedRepository.recordPlay(userId, game.id);

    return session;
  },

  async end(userId: string, gameSlug: string, sessionId: string, input: EndSessionInput) {
    const game = await gameRepository.findBySlug(gameSlug);
    if (!game) throw new NotFoundError("Game");

    const session = await gameSessionRepository.findById(sessionId);
    if (!session || session.userId !== userId || session.gameId !== game.id) {
      throw new NotFoundError("Game session");
    }
    if (session.status !== "IN_PROGRESS") {
      throw new ValidationError("This session has already been completed.");
    }

    const completed = await gameSessionRepository.complete(sessionId, {
      status: "COMPLETED",
      result: input.result,
      score: input.score,
      durationSeconds: input.durationSeconds,
      metadata: input.metadata,
    });

    const { stats, isNewHighScore } = await gameStatsRepository.recordSessionResult({
      userId,
      gameId: game.id,
      result: input.result,
      score: input.score,
      durationSeconds: input.durationSeconds,
    });

    // XP: base for playing + result-based + high-score bonus
    const xpAmount =
      XP_REWARDS.SESSION_PLAYED + xpForResult(input.result) + (isNewHighScore ? XP_REWARDS.HIGH_SCORE_BEATEN : 0);
    await xpService.award(userId, xpAmount, `game_session:${gameSlug}`, { sessionId });

    // Leaderboard: only score-worthy sessions post an entry (score > 0)
    const leaderboard = await leaderboardRepository.findAllTimeByGameId(game.id);
    if (leaderboard && input.score > 0) {
      await leaderboardRepository.submitScoreIfHigher(leaderboard.id, userId, input.score);
    }

    await checkAchievements({
      gameSlug,
      userId,
      result: input.result,
      score: input.score,
      stats: { wins: stats.wins },
    });

    return { session: completed, stats, xpAwarded: xpAmount, isNewHighScore };
  },

  async abandon(userId: string, sessionId: string) {
    const session = await gameSessionRepository.findById(sessionId);
    if (!session || session.userId !== userId) throw new NotFoundError("Game session");
    if (session.status !== "IN_PROGRESS") return session;

    return gameSessionRepository.complete(sessionId, {
      status: "ABANDONED",
      score: 0,
      durationSeconds: Math.floor((Date.now() - session.startedAt.getTime()) / 1000),
    });
  },

  async getMyStats(userId: string, gameSlug: string) {
    const game = await gameRepository.findBySlug(gameSlug);
    if (!game) throw new NotFoundError("Game");
    return gameStatsRepository.findByUserAndGame(userId, game.id);
  },

  async getLeaderboard(gameSlug: string, limit: number) {
    const game = await gameRepository.findBySlug(gameSlug);
    if (!game) throw new NotFoundError("Game");

    const leaderboard = await leaderboardRepository.findAllTimeByGameId(game.id);
    if (!leaderboard) return [];

    const entries = await leaderboardRepository.getTopEntries(leaderboard.id, limit);
    return entries.map(
      (
        entry: { user: { username: string }; score: bigint | number; updatedAt: Date },
        index: number
      ) => ({
        rank: index + 1,
        username: entry.user.username,
        score: entry.score.toString(),
        updatedAt: entry.updatedAt,
      })
    );
  },
};
