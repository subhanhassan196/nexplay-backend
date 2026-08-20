import { Router } from "express";
import { healthController } from "@/controllers/health.controller";

const router = Router();

router.get("/", healthController.liveness); // quick liveness
router.get("/detailed", healthController.detailed); // full subsystem report

export { router as healthRoutes };
