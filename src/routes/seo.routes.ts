import { Router } from "express";
import { seoController } from "@/controllers/seo.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";

const router = Router();

// Public
router.get("/meta", seoController.getForPath);
router.get("/sitemap.xml", seoController.sitemap);

// Admin
const admin = [requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN")] as const;
router.get("/", ...admin, seoController.list);
router.put("/", ...admin, seoController.upsert);
router.delete("/:path", ...admin, seoController.remove);

export { router as seoRoutes };
