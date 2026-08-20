import type { Request, Response } from "express";
import { gameService } from "@/services/game.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { listQuerySchema } from "@/utils/apiFeatures";

export const gameController = {
  /** Public platform counters used by the homepage stats strip. */
  publicStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await gameService.publicStats();
    return ApiResponse.success(res, 200, "Platform stats.", stats);
  }),

  /** Public category list — active categories only, with game counts. */
  listCategories: asyncHandler(async (_req: Request, res: Response) => {
    const categories = await gameService.listCategories();
    return ApiResponse.success(res, 200, "Categories retrieved.", { categories });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const category = typeof req.query.category === "string" ? req.query.category : undefined;

    const { items, pagination } = await gameService.list(query, { category });
    return ApiResponse.paginated(res, "Games retrieved.", items, pagination);
  }),

  getBySlug: asyncHandler(async (req: Request, res: Response) => {
    const game = await gameService.getBySlug(req.params.slug);
    return ApiResponse.success(res, 200, "Game retrieved.", { game });
  }),
};
