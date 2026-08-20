import { Router } from "express";
import { notificationController } from "@/controllers/notification.controller";
import { requireAuth } from "@/middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.patch("/:id/read", notificationController.markRead);
router.post("/read-all", notificationController.markAllRead);
router.delete("/clear-read", notificationController.clearRead);
router.delete("/:id", notificationController.delete);

export { router as notificationRoutes };
