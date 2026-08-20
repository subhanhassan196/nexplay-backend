import { Router } from "express";
import { searchController } from "@/controllers/search.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";

const router = Router();

router.use(requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));
router.get("/", searchController.global);

export { router as searchRoutes };
