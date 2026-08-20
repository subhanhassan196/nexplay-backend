import type { Request, Response } from "express";
import { adminUserService } from "@/services/adminUser.service";
import { adminRewardsService } from "@/services/adminRewards.service";
import { controlCenterService } from "@/services/controlCenter.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import type { Permission } from "@/constants/permissions";
import type { Role } from "@prisma/client";

export const adminPlatformController = {
  // ── Control Center ──
  controlCenter: asyncHandler(async (_req: Request, res: Response) => {
    const snapshot = await controlCenterService.snapshot();
    return ApiResponse.success(res, 200, "Control center.", snapshot);
  }),

  // ── Users & roles ──
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const data = await adminUserService.listUsers({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      role: typeof req.query.role === "string" ? (req.query.role as Role) : undefined,
      staffOnly: req.query.staffOnly === "true",
      skip: req.query.skip ? Number(req.query.skip) : 0,
      take: req.query.take ? Math.min(Number(req.query.take), 100) : 50,
    });
    return ApiResponse.success(res, 200, "Users.", data);
  }),

  setRole: asyncHandler(async (req: Request, res: Response) => {
    const user = await adminUserService.setRole(req.user!.id, req.user!.role, req.params.id, req.body.role);
    return ApiResponse.success(res, 200, "Role updated.", { user });
  }),

  setStatus: asyncHandler(async (req: Request, res: Response) => {
    const user = await adminUserService.setAccountStatus(req.user!.id, req.user!.role, req.params.id, req.body.status);
    return ApiResponse.success(res, 200, "Status updated.", { user });
  }),

  getPermissions: asyncHandler(async (req: Request, res: Response) => {
    const data = await adminUserService.getUserPermissions(req.params.id);
    return ApiResponse.success(res, 200, "Permissions.", data);
  }),

  setPermission: asyncHandler(async (req: Request, res: Response) => {
    const row = await adminUserService.setPermission(
      req.user!.id,
      req.user!.role,
      req.params.id,
      req.body.permission as Permission,
      Boolean(req.body.granted)
    );
    return ApiResponse.success(res, 200, "Permission updated.", { permission: row });
  }),

  clearPermission: asyncHandler(async (req: Request, res: Response) => {
    await adminUserService.clearPermission(
      req.user!.id,
      req.user!.role,
      req.params.id,
      req.body.permission as Permission
    );
    return ApiResponse.success(res, 200, "Permission reset to role default.", {});
  }),

  // ── Rewards configuration ──
  listSegments: asyncHandler(async (_req: Request, res: Response) => {
    const segments = await adminRewardsService.listSegments();
    return ApiResponse.success(res, 200, "Wheel segments.", { segments });
  }),

  createSegment: asyncHandler(async (req: Request, res: Response) => {
    const segment = await adminRewardsService.createSegment(req.body, req.user?.id);
    return ApiResponse.success(res, 201, "Segment created.", { segment });
  }),

  updateSegment: asyncHandler(async (req: Request, res: Response) => {
    const segment = await adminRewardsService.updateSegment(req.params.id, req.body, req.user?.id);
    return ApiResponse.success(res, 200, "Segment updated.", { segment });
  }),

  deleteSegment: asyncHandler(async (req: Request, res: Response) => {
    const result = await adminRewardsService.deleteSegment(req.params.id, req.user?.id);
    return ApiResponse.success(res, 200, "Segment removed.", result);
  }),

  listDaily: asyncHandler(async (_req: Request, res: Response) => {
    const config = await adminRewardsService.listDailyConfig();
    return ApiResponse.success(res, 200, "Daily config.", { config });
  }),

  upsertDaily: asyncHandler(async (req: Request, res: Response) => {
    const { dayNumber, ...data } = req.body;
    const config = await adminRewardsService.upsertDailyConfig(Number(dayNumber), data, req.user?.id);
    return ApiResponse.success(res, 200, "Daily reward saved.", { config });
  }),

  deleteDaily: asyncHandler(async (req: Request, res: Response) => {
    await adminRewardsService.deleteDailyConfig(req.params.id, req.user?.id);
    return ApiResponse.success(res, 200, "Daily reward deleted.", {});
  }),

  listStore: asyncHandler(async (_req: Request, res: Response) => {
    const items = await adminRewardsService.listStoreItems();
    return ApiResponse.success(res, 200, "Store items.", { items });
  }),

  createStoreItem: asyncHandler(async (req: Request, res: Response) => {
    const item = await adminRewardsService.createStoreItem(req.body, req.user?.id);
    return ApiResponse.success(res, 201, "Item created.", { item });
  }),

  updateStoreItem: asyncHandler(async (req: Request, res: Response) => {
    const item = await adminRewardsService.updateStoreItem(req.params.id, req.body, req.user?.id);
    return ApiResponse.success(res, 200, "Item updated.", { item });
  }),

  deleteStoreItem: asyncHandler(async (req: Request, res: Response) => {
    const result = await adminRewardsService.deleteStoreItem(req.params.id, req.user?.id);
    return ApiResponse.success(res, 200, "Item removed.", result);
  }),

  recentRedemptions: asyncHandler(async (_req: Request, res: Response) => {
    const items = await adminRewardsService.recentRedemptions();
    return ApiResponse.success(res, 200, "Redemptions.", { items });
  }),
};
