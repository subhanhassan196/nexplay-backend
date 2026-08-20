import { Router } from "express";
import { adminGameController } from "@/controllers/adminGame.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";

const router = Router();

// Every route here is admin-only; role is read from the verified JWT,
// never from the request body.
router.use(requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));

// Games
router.get("/games", adminGameController.listGames);
router.post("/games", adminGameController.createGame);
router.post("/games/reorder", adminGameController.reorderGames);
router.get("/games/:id", adminGameController.getGame);
router.patch("/games/:id", adminGameController.updateGame);
router.delete("/games/:id", adminGameController.archiveGame);
router.post("/games/:id/restore", adminGameController.restoreGame);

// Categories
router.get("/categories", adminGameController.listCategories);
router.post("/categories", adminGameController.createCategory);
router.post("/categories/reorder", adminGameController.reorderCategories);
router.patch("/categories/:id", adminGameController.updateCategory);
router.delete("/categories/:id", adminGameController.deleteCategory);
router.patch("/categories/assign/:gameId", adminGameController.assignGame);

export { router as adminGameRoutes };
