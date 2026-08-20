import { Router } from "express";
import { communityController } from "@/controllers/community.controller";
import { requireAuth, attachUserIfPresent, requirePermission } from "@/middlewares/auth.middleware";
import { PERMISSIONS } from "@/constants/permissions";

const router = Router();

// Reading the feed is public. `attachUserIfPresent` means a signed-in
// visitor also gets their like state back on the same request.
router.get("/posts", attachUserIfPresent, communityController.listPosts);
router.get("/posts/:id", communityController.getPost);
router.get("/posts/:id/comments", communityController.listComments);

// Writing requires an account; ownership is enforced in the service.
router.post("/posts", requireAuth, communityController.createPost);
router.patch("/posts/:id", requireAuth, communityController.updatePost);
router.delete("/posts/:id", requireAuth, communityController.deletePost);
router.post("/posts/:id/like", requireAuth, communityController.toggleLike);

router.post("/posts/:id/comments", requireAuth, communityController.addComment);
router.patch("/comments/:commentId", requireAuth, communityController.updateComment);
router.delete("/comments/:commentId", requireAuth, communityController.deleteComment);
router.post("/comments/:commentId/like", requireAuth, communityController.toggleCommentLike);

export { router as communityRoutes };

// Moderation lives under /admin so it inherits the admin permission model.
const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.get("/posts", requirePermission(PERMISSIONS.CONTENT_READ), communityController.adminListPosts);
adminRouter.delete("/posts/:id", requirePermission(PERMISSIONS.CONTENT_DELETE), communityController.deletePost);
adminRouter.post("/posts/:id/restore", requirePermission(PERMISSIONS.CONTENT_UPDATE), communityController.restorePost);
adminRouter.delete("/comments/:commentId", requirePermission(PERMISSIONS.CONTENT_DELETE), communityController.deleteComment);

export { adminRouter as adminCommunityRoutes };
