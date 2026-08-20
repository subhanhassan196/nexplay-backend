import { Router } from "express";
import { leaderboardController } from "@/controllers/platform.controller";
import { requireAuth } from "@/middlewares/auth.middleware";

const router = Router();

router.get("/", leaderboardController.global);
router.get("/weekly", leaderboardController.weekly);
router.get("/friends", requireAuth, leaderboardController.friends);

export { router as leaderboardRoutes };
