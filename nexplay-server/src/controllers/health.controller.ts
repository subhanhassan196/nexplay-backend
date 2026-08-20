import type { Request, Response } from "express";
import { healthService } from "@/services/health.service";
import { asyncHandler } from "@/utils/asyncHandler";

export const healthController = {
  // Full health report (used by monitoring dashboards).
  detailed: asyncHandler(async (_req: Request, res: Response) => {
    const report = await healthService.check();
    res.status(report.status === "healthy" ? 200 : 503).json(report);
  }),

  // Liveness probe (used by orchestrators / uptime pings).
  liveness: (_req: Request, res: Response) => {
    res.json(healthService.liveness());
  },
};
