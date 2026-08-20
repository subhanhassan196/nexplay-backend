import { Router } from "express";
import { rewardsController } from "@/controllers/platform.controller";
import { requireAuth } from "@/middlewares/auth.middleware";

const router = Router();

// Public — wheel layout and store catalogue are browsable logged-out.
router.get("/wheel", rewardsController.wheelSegments);
router.get("/store", rewardsController.storeItems);

// Everything that touches a balance requires auth.
router.use(requireAuth);
router.get("/balance", rewardsController.balance);
router.get("/transactions", rewardsController.transactions);
router.get("/wheel/status", rewardsController.spinStatus);
router.post("/wheel/spin", rewardsController.spin);
router.get("/daily", rewardsController.dailyStatus);
router.post("/daily/claim", rewardsController.claimDaily);
router.post("/store/:id/redeem", rewardsController.redeem);
router.get("/store/redemptions", rewardsController.myRedemptions);

export { router as rewardsRoutes };
