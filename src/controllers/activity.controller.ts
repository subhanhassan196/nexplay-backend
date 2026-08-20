import type { Request, Response } from "express";
import { activityService } from "@/services/activity.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { listQuerySchema } from "@/utils/apiFeatures";

export const activityController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const actorId = typeof req.query.actorId === "string" ? req.query.actorId : undefined;

    const { items, pagination } = await activityService.list(query, { action, entityType, actorId });
    return ApiResponse.paginated(res, "Activity retrieved.", items, pagination);
  }),
};
