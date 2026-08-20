import type { Request, Response } from "express";
import { rewardsService } from "@/services/rewards.service";
import { leaderboardService } from "@/services/leaderboard.service";
import { tournamentService } from "@/services/tournament.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import type { TournamentStatus } from "@prisma/client";

export const rewardsController = {
  balance: asyncHandler(async (req: Request, res: Response) => {
    const data = await rewardsService.getBalance(req.user!.id);
    return ApiResponse.success(res, 200, "Balance.", data);
  }),

  transactions: asyncHandler(async (req: Request, res: Response) => {
    const items = await rewardsService.getTransactions(req.user!.id);
    return ApiResponse.success(res, 200, "Transactions.", { items });
  }),

  // Wheel
  wheelSegments: asyncHandler(async (_req: Request, res: Response) => {
    const segments = await rewardsService.getWheelSegments();
    return ApiResponse.success(res, 200, "Wheel.", { segments });
  }),

  spinStatus: asyncHandler(async (req: Request, res: Response) => {
    const data = await rewardsService.getSpinStatus(req.user!.id);
    return ApiResponse.success(res, 200, "Spin status.", data);
  }),

  spin: asyncHandler(async (req: Request, res: Response) => {
    const data = await rewardsService.spin(req.user!.id);
    return ApiResponse.success(res, 200, "Spin complete.", data);
  }),

  // Daily
  dailyStatus: asyncHandler(async (req: Request, res: Response) => {
    const data = await rewardsService.getDailyStatus(req.user!.id);
    return ApiResponse.success(res, 200, "Daily status.", data);
  }),

  claimDaily: asyncHandler(async (req: Request, res: Response) => {
    const data = await rewardsService.claimDaily(req.user!.id);
    return ApiResponse.success(res, 200, "Reward claimed.", data);
  }),

  // Store
  storeItems: asyncHandler(async (_req: Request, res: Response) => {
    const items = await rewardsService.listStoreItems();
    return ApiResponse.success(res, 200, "Store items.", { items });
  }),

  redeem: asyncHandler(async (req: Request, res: Response) => {
    const data = await rewardsService.redeem(req.user!.id, req.params.id);
    return ApiResponse.success(res, 200, "Redeemed.", data);
  }),

  myRedemptions: asyncHandler(async (req: Request, res: Response) => {
    const items = await rewardsService.myRedemptions(req.user!.id);
    return ApiResponse.success(res, 200, "Redemptions.", { items });
  }),
};

export const leaderboardController = {
  global: asyncHandler(async (req: Request, res: Response) => {
    const gameId = typeof req.query.gameId === "string" ? req.query.gameId : undefined;
    const entries = await leaderboardService.global(50, gameId);
    return ApiResponse.success(res, 200, "Global leaderboard.", { entries });
  }),

  weekly: asyncHandler(async (_req: Request, res: Response) => {
    const entries = await leaderboardService.weekly();
    return ApiResponse.success(res, 200, "Weekly leaderboard.", { entries });
  }),

  friends: asyncHandler(async (req: Request, res: Response) => {
    const entries = await leaderboardService.friends(req.user!.id);
    return ApiResponse.success(res, 200, "Friends leaderboard.", { entries });
  }),
};

export const tournamentController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const status = typeof req.query.status === "string" ? (req.query.status as TournamentStatus) : undefined;
    const gameSlug = typeof req.query.game === "string" ? req.query.game : undefined;
    const tournaments = await tournamentService.list({ status, gameSlug });
    return ApiResponse.success(res, 200, "Tournaments.", { tournaments });
  }),

  getBySlug: asyncHandler(async (req: Request, res: Response) => {
    const tournament = await tournamentService.getBySlug(req.params.slug);
    return ApiResponse.success(res, 200, "Tournament.", { tournament });
  }),

  register: asyncHandler(async (req: Request, res: Response) => {
    const participant = await tournamentService.register(req.user!.id, req.params.slug);
    return ApiResponse.success(res, 201, "Registered.", { participant });
  }),

  // Admin
  adminList: asyncHandler(async (_req: Request, res: Response) => {
    const tournaments = await tournamentService.adminList();
    return ApiResponse.success(res, 200, "Tournaments.", { tournaments });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const tournament = await tournamentService.create(req.body, req.user?.id);
    return ApiResponse.success(res, 201, "Tournament created.", { tournament });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const tournament = await tournamentService.update(req.params.id, req.body, req.user?.id);
    return ApiResponse.success(res, 200, "Tournament updated.", { tournament });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await tournamentService.remove(req.params.id, req.user?.id);
    return ApiResponse.success(res, 200, "Tournament deleted.", {});
  }),
};
