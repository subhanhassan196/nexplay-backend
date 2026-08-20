import type { Request, Response } from "express";
import { communityService } from "@/services/community.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";

/** Caps page size so a crafted `take=100000` can't strain the database. */
function pageArgs(req: Request, defaultTake = 20) {
  const take = req.query.take ? Math.min(Math.max(Number(req.query.take) || defaultTake, 1), 50) : defaultTake;
  const skip = req.query.skip ? Math.max(Number(req.query.skip) || 0, 0) : 0;
  return { skip, take };
}

export const communityController = {
  // ── Posts ──
  listPosts: asyncHandler(async (req: Request, res: Response) => {
    const { skip, take } = pageArgs(req);
    const { posts, total } = await communityService.listPosts({
      skip,
      take,
      gameSlug: typeof req.query.game === "string" ? req.query.game : undefined,
      authorId: typeof req.query.author === "string" ? req.query.author : undefined,
    });

    // Tell a signed-in viewer which posts they've already liked, so the
    // heart renders correctly on first paint instead of after a second call.
    const likedPostIds = req.user
      ? await communityService.likedPostIds(
          req.user.id,
          posts.map((p: { id: string }) => p.id)
        )
      : [];

    return ApiResponse.success(res, 200, "Posts.", { posts, total, likedPostIds });
  }),

  getPost: asyncHandler(async (req: Request, res: Response) => {
    const post = await communityService.getPost(req.params.id);
    return ApiResponse.success(res, 200, "Post.", { post });
  }),

  createPost: asyncHandler(async (req: Request, res: Response) => {
    const post = await communityService.createPost(req.user!.id, req.body);
    return ApiResponse.success(res, 201, "Post created.", { post });
  }),

  updatePost: asyncHandler(async (req: Request, res: Response) => {
    const post = await communityService.updatePost(req.user!.id, req.user!.role, req.params.id, req.body.content);
    return ApiResponse.success(res, 200, "Post updated.", { post });
  }),

  deletePost: asyncHandler(async (req: Request, res: Response) => {
    await communityService.deletePost(req.user!.id, req.user!.role, req.params.id, req.body?.reason);
    return ApiResponse.success(res, 200, "Post deleted.", {});
  }),

  restorePost: asyncHandler(async (req: Request, res: Response) => {
    const post = await communityService.restorePost(req.user!.id, req.params.id);
    return ApiResponse.success(res, 200, "Post restored.", { post });
  }),

  // ── Comments ──
  listComments: asyncHandler(async (req: Request, res: Response) => {
    const { skip, take } = pageArgs(req);
    const data = await communityService.listComments(req.params.id, { skip, take });
    return ApiResponse.success(res, 200, "Comments.", data);
  }),

  addComment: asyncHandler(async (req: Request, res: Response) => {
    const comment = await communityService.addComment(
      req.user!.id,
      req.params.id,
      req.body.content,
      req.body.parentCommentId
    );
    return ApiResponse.success(res, 201, "Comment added.", { comment });
  }),

  updateComment: asyncHandler(async (req: Request, res: Response) => {
    const comment = await communityService.updateComment(
      req.user!.id,
      req.user!.role,
      req.params.commentId,
      req.body.content
    );
    return ApiResponse.success(res, 200, "Comment updated.", { comment });
  }),

  deleteComment: asyncHandler(async (req: Request, res: Response) => {
    await communityService.deleteComment(req.user!.id, req.user!.role, req.params.commentId);
    return ApiResponse.success(res, 200, "Comment deleted.", {});
  }),

  // ── Likes ──
  toggleLike: asyncHandler(async (req: Request, res: Response) => {
    const result = await communityService.toggleLike(req.user!.id, req.params.id);
    return ApiResponse.success(res, 200, "Like updated.", result);
  }),

  toggleCommentLike: asyncHandler(async (req: Request, res: Response) => {
    const result = await communityService.toggleCommentLike(req.user!.id, req.params.commentId);
    return ApiResponse.success(res, 200, "Like updated.", result);
  }),

  // ── Moderation ──
  adminListPosts: asyncHandler(async (req: Request, res: Response) => {
    const { skip, take } = pageArgs(req, 30);
    const data = await communityService.adminListPosts({
      skip,
      take,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      includeDeleted: req.query.includeDeleted === "true",
    });
    return ApiResponse.success(res, 200, "Posts.", data);
  }),
};
