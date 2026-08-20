import type { Request, Response } from "express";
import { searchService } from "@/services/search.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";

export const searchController = {
  global: asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const results = await searchService.globalSearch(q);
    return ApiResponse.success(res, 200, "Search results.", results);
  }),
};
