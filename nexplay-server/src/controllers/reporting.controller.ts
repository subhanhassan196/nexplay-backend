import type { Request, Response } from "express";
import { reportingService } from "@/services/reporting.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";

function parseDays(req: Request): number {
  const raw = parseInt(String(req.query.days ?? "30"), 10);
  return [7, 30, 90].includes(raw) ? raw : 30;
}

export const reportingController = {
  overview: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportingService.overview(parseDays(req));
    return ApiResponse.success(res, 200, "Report overview.", data);
  }),

  trends: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportingService.trends(parseDays(req));
    return ApiResponse.success(res, 200, "Ticket trends.", { trends: data });
  }),

  breakdown: asyncHandler(async (_req: Request, res: Response) => {
    const data = await reportingService.breakdown();
    return ApiResponse.success(res, 200, "Ticket breakdown.", data);
  }),

  agents: asyncHandler(async (req: Request, res: Response) => {
    const data = await reportingService.agentPerformance(parseDays(req));
    return ApiResponse.success(res, 200, "Agent performance.", { agents: data });
  }),
};
