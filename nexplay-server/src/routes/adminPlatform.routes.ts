import { Router } from "express";
import { adminPlatformController } from "@/controllers/adminPlatform.controller";
import { requireAuth, requirePermission } from "@/middlewares/auth.middleware";
import { PERMISSIONS } from "@/constants/permissions";

const router = Router();

// Authorization is capability-based, not role-based: a Support Agent
// hitting these URLs directly is rejected here, at the API layer.
router.use(requireAuth);

// Control Center — visible to anyone who can read settings (Admin+).
router.get("/control-center", requirePermission(PERMISSIONS.SETTINGS_READ), adminPlatformController.controlCenter);

// Users & roles
router.get("/users", requirePermission(PERMISSIONS.USERS_READ), adminPlatformController.listUsers);
router.patch("/users/:id/role", requirePermission(PERMISSIONS.ROLES_MANAGE), adminPlatformController.setRole);
router.patch("/users/:id/status", requirePermission(PERMISSIONS.USERS_UPDATE), adminPlatformController.setStatus);

// Granular permissions — super admin only, via PERMISSIONS_MANAGE.
router.get("/users/:id/permissions", requirePermission(PERMISSIONS.PERMISSIONS_MANAGE), adminPlatformController.getPermissions);
router.put("/users/:id/permissions", requirePermission(PERMISSIONS.PERMISSIONS_MANAGE), adminPlatformController.setPermission);
router.delete("/users/:id/permissions", requirePermission(PERMISSIONS.PERMISSIONS_MANAGE), adminPlatformController.clearPermission);

// Wheel configuration
router.get("/rewards/wheel", requirePermission(PERMISSIONS.REWARDS_READ), adminPlatformController.listSegments);
router.post("/rewards/wheel", requirePermission(PERMISSIONS.REWARDS_CREATE), adminPlatformController.createSegment);
router.patch("/rewards/wheel/:id", requirePermission(PERMISSIONS.REWARDS_UPDATE), adminPlatformController.updateSegment);
router.delete("/rewards/wheel/:id", requirePermission(PERMISSIONS.REWARDS_DELETE), adminPlatformController.deleteSegment);

// Daily ladder
router.get("/rewards/daily", requirePermission(PERMISSIONS.REWARDS_READ), adminPlatformController.listDaily);
router.put("/rewards/daily", requirePermission(PERMISSIONS.REWARDS_UPDATE), adminPlatformController.upsertDaily);
router.delete("/rewards/daily/:id", requirePermission(PERMISSIONS.REWARDS_DELETE), adminPlatformController.deleteDaily);

// Store
router.get("/rewards/store", requirePermission(PERMISSIONS.REWARDS_READ), adminPlatformController.listStore);
router.post("/rewards/store", requirePermission(PERMISSIONS.REWARDS_CREATE), adminPlatformController.createStoreItem);
router.patch("/rewards/store/:id", requirePermission(PERMISSIONS.REWARDS_UPDATE), adminPlatformController.updateStoreItem);
router.delete("/rewards/store/:id", requirePermission(PERMISSIONS.REWARDS_DELETE), adminPlatformController.deleteStoreItem);
router.get("/rewards/redemptions", requirePermission(PERMISSIONS.REWARDS_READ), adminPlatformController.recentRedemptions);

export { router as adminPlatformRoutes };
