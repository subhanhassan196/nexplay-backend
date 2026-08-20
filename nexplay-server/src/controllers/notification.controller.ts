import type { Request, Response } from "express";
import { notificationService } from "@/services/notification.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { listQuerySchema } from "@/utils/apiFeatures";

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listQuerySchema.parse(req.query);
    const unreadOnly = req.query.unreadOnly === "true";
    const data = await notificationService.list(req.user!.id, query, unreadOnly);
    return ApiResponse.success(res, 200, "Notifications retrieved.", data);
  }),

  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    const count = await notificationService.getUnreadCount(req.user!.id);
    return ApiResponse.success(res, 200, "Unread count.", { count });
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markRead(req.user!.id, req.params.id);
    return ApiResponse.success(res, 200, "Marked as read.", {});
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.user!.id);
    return ApiResponse.success(res, 200, "All marked as read.", {});
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.delete(req.user!.id, req.params.id);
    return ApiResponse.success(res, 200, "Notification deleted.", {});
  }),

  clearRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.clearRead(req.user!.id);
    return ApiResponse.success(res, 200, "Read notifications cleared.", {});
  }),
};
