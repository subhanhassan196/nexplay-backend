import type { Request, Response } from "express";
import { adminGameService } from "@/services/adminGame.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";

export const adminGameController = {
  // ── Games ──
  listGames: asyncHandler(async (req: Request, res: Response) => {
    const games = await adminGameService.listGames({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
      includeArchived: req.query.includeArchived === "true",
    });
    return ApiResponse.success(res, 200, "Games retrieved.", { games });
  }),

  getGame: asyncHandler(async (req: Request, res: Response) => {
    const game = await adminGameService.getGame(req.params.id);
    return ApiResponse.success(res, 200, "Game retrieved.", { game });
  }),

  createGame: asyncHandler(async (req: Request, res: Response) => {
    const game = await adminGameService.createGame(req.body, req.user?.id);
    return ApiResponse.success(res, 201, "Game created.", { game });
  }),

  updateGame: asyncHandler(async (req: Request, res: Response) => {
    const game = await adminGameService.updateGame(req.params.id, req.body, req.user?.id);
    return ApiResponse.success(res, 200, "Game updated.", { game });
  }),

  archiveGame: asyncHandler(async (req: Request, res: Response) => {
    await adminGameService.archiveGame(req.params.id, req.user?.id);
    return ApiResponse.success(res, 200, "Game archived.", {});
  }),

  restoreGame: asyncHandler(async (req: Request, res: Response) => {
    const game = await adminGameService.restoreGame(req.params.id);
    return ApiResponse.success(res, 200, "Game restored.", { game });
  }),

  reorderGames: asyncHandler(async (req: Request, res: Response) => {
    const result = await adminGameService.reorderGames(req.body.items);
    return ApiResponse.success(res, 200, "Order updated.", result);
  }),

  // ── Categories ──
  listCategories: asyncHandler(async (req: Request, res: Response) => {
    const categories = await adminGameService.listCategories(req.query.includeInactive === "true");
    return ApiResponse.success(res, 200, "Categories retrieved.", { categories });
  }),

  createCategory: asyncHandler(async (req: Request, res: Response) => {
    const category = await adminGameService.createCategory(req.body);
    return ApiResponse.success(res, 201, "Category created.", { category });
  }),

  updateCategory: asyncHandler(async (req: Request, res: Response) => {
    const category = await adminGameService.updateCategory(req.params.id, req.body);
    return ApiResponse.success(res, 200, "Category updated.", { category });
  }),

  deleteCategory: asyncHandler(async (req: Request, res: Response) => {
    await adminGameService.deleteCategory(req.params.id);
    return ApiResponse.success(res, 200, "Category deleted.", {});
  }),

  reorderCategories: asyncHandler(async (req: Request, res: Response) => {
    const result = await adminGameService.reorderCategories(req.body.items);
    return ApiResponse.success(res, 200, "Order updated.", result);
  }),

  assignGame: asyncHandler(async (req: Request, res: Response) => {
    const game = await adminGameService.assignGameToCategory(req.params.gameId, req.body.categoryId ?? null);
    return ApiResponse.success(res, 200, "Game assigned.", { game });
  }),
};
