import { Router } from "express";
import { communityController } from "@/controllers/community.controller";
import { requireAuth } from "@/middlewares/auth.middleware";

const router = Router();

// Reading the feed is public; posting requires an account.
router.get("/posts", communityController.listPosts);
router.get("/posts/:id", communityController.getPost);

router.post("/posts", requireAuth, communityController.createPost);
router.post("/posts/:id/comments", requireAuth, communityController.addComment);
router.post("/posts/:id/like", requireAuth, communityController.toggleLike);
router.delete("/posts/:id", requireAuth, communityController.deletePost);

export { router as communityRoutes };
