import { Router } from "express";
import { tournamentController } from "@/controllers/platform.controller";
import { requireAuth, requireRole } from "@/middlewares/auth.middleware";

const router = Router();

// Public
router.get("/", tournamentController.list);
router.get("/:slug", tournamentController.getBySlug);
router.post("/:slug/register", requireAuth, tournamentController.register);

export { router as tournamentRoutes };

// Admin-only management, mounted separately under /admin.
const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("MODERATOR", "ADMIN", "SUPER_ADMIN"));
adminRouter.get("/", tournamentController.adminList);
adminRouter.post("/", tournamentController.create);
adminRouter.patch("/:id", tournamentController.update);
adminRouter.delete("/:id", tournamentController.remove);

export { adminRouter as adminTournamentRoutes };
