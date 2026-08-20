import { Router } from "express";
import { mediaController } from "@/controllers/media.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";
import { mediaUpload } from "@/middlewares/upload.middleware";

const router = Router();

router.use(requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));

router.get("/", mediaController.list);
router.post("/", mediaUpload, mediaController.upload);
router.patch("/:id", mediaController.update);
router.delete("/:id", mediaController.remove);

export { router as mediaRoutes };
