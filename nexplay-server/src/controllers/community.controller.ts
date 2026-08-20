import type { Request, Response } from "express";
import { communityService } from "@/services/community.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";

const MODERATOR_ROLES = ["MODERATOR", "ADMIN", "SUPER_ADMIN"];

export const communityController = {
  listPosts: asyncHandler(async (req: Request, res: Response) => {
    const posts = await communityService.listPosts({
      skip: req.query.skip ? Number(req.query.skip) : 0,
      take: req.query.take ? Math.min(Number(req.query.take), 50) : 20,
      gameSlug: typeof req.query.game === "string" ? req.query.game : undefined,
    });
    return ApiResponse.success(res, 200, "Posts.", { posts });
  }),

  getPost: asyncHandler(async (req: Request, res: Response) => {
    const post = await communityService.getPost(req.params.id);
    return ApiResponse.success(res, 200, "Post.", { post });
  }),

  createPost: asyncHandler(async (req: Request, res: Response) => {
    const post = await communityService.createPost(req.user!.id, req.body);
    return ApiResponse.success(res, 201, "Post created.", { post });
  }),

  addComment: asyncHandler(async (req: Request, res: Response) => {
    const comment = await communityService.addComment(req.user!.id, req.params.id, req.body.content);
    return ApiResponse.success(res, 201, "Comment added.", { comment });
  }),

  toggleLike: asyncHandler(async (req: Request, res: Response) => {
    const result = await communityService.toggleLike(req.user!.id, req.params.id);
    return ApiResponse.success(res, 200, "Like updated.", result);
  }),

  deletePost: asyncHandler(async (req: Request, res: Response) => {
    const isModerator = MODERATOR_ROLES.includes(req.user!.role);
    await communityService.deletePost(req.user!.id, req.params.id, isModerator);
    return ApiResponse.success(res, 200, "Post deleted.", {});
  }),
};
