import type { Request, Response } from "express";
import { gameSessionService } from "@/services/gameSession.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";

export const gameSessionController = {
  start: asyncHandler(async (req: Request, res: Response) => {
    const session = await gameSessionService.start(req.user!.id, req.params.slug, req.body);
    return ApiResponse.success(res, 201, "Session started.", { session });
  }),

  end: asyncHandler(async (req: Request, res: Response) => {
    const result = await gameSessionService.end(req.user!.id, req.params.slug, req.params.sessionId, req.body);
    return ApiResponse.success(res, 200, "Session recorded.", result);
  }),

  abandon: asyncHandler(async (req: Request, res: Response) => {
    const session = await gameSessionService.abandon(req.user!.id, req.params.sessionId);
    return ApiResponse.success(res, 200, "Session marked abandoned.", { session });
  }),

  myStats: asyncHandler(async (req: Request, res: Response) => {
    const stats = await gameSessionService.getMyStats(req.user!.id, req.params.slug);
    return ApiResponse.success(res, 200, "Stats retrieved.", { stats });
  }),

  leaderboard: asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const entries = await gameSessionService.getLeaderboard(req.params.slug, limit);
    return ApiResponse.success(res, 200, "Leaderboard retrieved.", { entries });
  }),
};
