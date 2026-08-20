import { Router } from "express";
import { reportingController } from "@/controllers/reporting.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";

const router = Router();

router.use(requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));

router.get("/overview", reportingController.overview);
router.get("/trends", reportingController.trends);
router.get("/breakdown", reportingController.breakdown);
router.get("/agents", reportingController.agents);

export { router as reportingRoutes };
