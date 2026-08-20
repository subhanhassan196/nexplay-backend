import { Router } from "express";
import { activityController } from "@/controllers/activity.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";

const router = Router();

router.use(requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));
router.get("/", activityController.list);

export { router as activityRoutes };
