import type { Request, Response } from "express";
import { userService } from "@/services/user.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { ApiError } from "@/utils/ApiError";

export const userController = {
  getMyProfile: asyncHandler(async (req: Request, res: Response) => {
    const profile = await userService.getProfile(req.user!.id);
    return ApiResponse.success(res, 200, "Profile retrieved.", { profile });
  }),

  updateMyProfile: asyncHandler(async (req: Request, res: Response) => {
    const profile = await userService.updateProfile(req.user!.id, req.body);
    return ApiResponse.success(res, 200, "Profile updated.", { profile });
  }),

  getMySettings: asyncHandler(async (req: Request, res: Response) => {
    const settings = await userService.getSettings(req.user!.id);
    return ApiResponse.success(res, 200, "Settings retrieved.", { settings });
  }),

  updateMySettings: asyncHandler(async (req: Request, res: Response) => {
    const settings = await userService.updateSettings(req.user!.id, req.body);
    return ApiResponse.success(res, 200, "Settings updated.", { settings });
  }),

  uploadAvatar: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest("No avatar file provided.");
    const profile = await userService.uploadAvatar(req.user!.id, req.file.buffer);
    return ApiResponse.success(res, 200, "Avatar updated.", { profile });
  }),

  uploadBanner: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest("No banner file provided.");
    const profile = await userService.uploadBanner(req.user!.id, req.file.buffer);
    return ApiResponse.success(res, 200, "Banner updated.", { profile });
  }),
};
