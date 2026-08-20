import { Router } from "express";
import { gameController } from "@/controllers/game.controller";
import { gameSessionController } from "@/controllers/gameSession.controller";
import { requireAuth, attachUserIfPresent } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validate.middleware";
import { startSessionSchema, endSessionSchema } from "@/validators/gameSession.validator";

const router = Router();

// ── Public catalog reads ─────────────────────────
router.get("/", attachUserIfPresent, gameController.list);
// Must be declared before "/:slug" so it isn't captured as a game slug.
router.get("/categories", gameController.listCategories);
router.get("/stats", gameController.publicStats);
router.get("/:slug", attachUserIfPresent, gameController.getBySlug);
router.get("/:slug/leaderboard", gameSessionController.leaderboard);

// ── Authenticated gameplay ───────────────────────
router.post("/:slug/sessions", requireAuth, validate(startSessionSchema), gameSessionController.start);
router.patch(
  "/:slug/sessions/:sessionId",
  requireAuth,
  validate(endSessionSchema),
  gameSessionController.end
);
router.post("/:slug/sessions/:sessionId/abandon", requireAuth, gameSessionController.abandon);
router.get("/:slug/stats/me", requireAuth, gameSessionController.myStats);

export { router as gamesRoutes };
