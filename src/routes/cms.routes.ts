import { Router } from "express";
import { cmsController } from "@/controllers/cms.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";

const router = Router();

// ── Public reads (no auth) ──
router.get("/content", cmsController.listContent);
router.get("/content/:key", cmsController.getContent);
router.get("/banners", cmsController.listBanners);
router.get("/legal", cmsController.listLegalPages);
router.get("/legal/:slug", cmsController.getLegalPage);
router.get("/faq", cmsController.listFaq);

// ── Admin writes (MODERATOR+) ──
const admin = [requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN")] as const;

router.put("/content/:key", ...admin, cmsController.setContent);
router.delete("/content/:key", ...admin, cmsController.deleteContent);

router.post("/banners", ...admin, cmsController.createBanner);
router.patch("/banners/:id", ...admin, cmsController.updateBanner);
router.delete("/banners/:id", ...admin, cmsController.deleteBanner);

router.put("/legal/:slug", ...admin, cmsController.upsertLegalPage);
router.delete("/legal/:slug", ...admin, cmsController.deleteLegalPage);

router.post("/faq", ...admin, cmsController.createFaq);
router.patch("/faq/:id", ...admin, cmsController.updateFaq);
router.delete("/faq/:id", ...admin, cmsController.deleteFaq);

export { router as cmsRoutes };
