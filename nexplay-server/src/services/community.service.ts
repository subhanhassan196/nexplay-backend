import { prisma } from "@/config/db";
import { NotFoundError, ValidationError } from "@/errors";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import { stripHtml } from "@/helpers/sanitize";
import type { Prisma } from "@prisma/client";

/**
 * Community feed. Posts, comments and likes are all real records — the
 * feed is empty until someone posts rather than seeded with sample
 * conversations.
 *
 * All user text is stripped of markup on the way in; the frontend renders
 * it as plain text, so this is defence-in-depth against stored XSS.
 */
const postSelect = {
  id: true,
  content: true,
  mediaUrls: true,
  createdAt: true,
  user: { select: { id: true, username: true, profile: { select: { avatarUrl: true } } } },
  game: { select: { id: true, slug: true, title: true } },
  _count: { select: { comments: true, likes: true } },
} satisfies Prisma.CommunityPostSelect;

function flatten<T extends { user: { profile: { avatarUrl: string | null } | null } }>(post: T) {
  const { user, ...rest } = post;
  const { profile, ...userRest } = user;
  return { ...rest, user: { ...userRest, avatarUrl: profile?.avatarUrl ?? null } };
}

export const communityService = {
  async listPosts(args: { skip?: number; take?: number; gameSlug?: string }) {
    const posts = await prisma.communityPost.findMany({
      where: args.gameSlug ? { game: { slug: args.gameSlug } } : {},
      orderBy: { createdAt: "desc" },
      skip: args.skip ?? 0,
      take: args.take ?? 20,
      select: postSelect,
    });
    return posts.map(flatten);
  },

  async getPost(id: string) {
    const post = await prisma.communityPost.findUnique({
      where: { id },
      select: {
        ...postSelect,
        comments: {
          orderBy: { createdAt: "asc" },
          take: 100,
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: { select: { id: true, username: true, profile: { select: { avatarUrl: true } } } },
          },
        },
      },
    });
    if (!post) throw new NotFoundError("Post");
    return flatten(post);
  },

  async createPost(userId: string, data: { content: string; gameId?: string; mediaUrls?: string[] }) {
    const content = stripHtml(data.content).trim();
    if (!content) throw new ValidationError("Post content is required.");

    const post = await prisma.communityPost.create({
      data: { userId, content, gameId: data.gameId, mediaUrls: data.mediaUrls ?? [] },
      select: postSelect,
    });

    void activityService.record({
      actorId: userId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "CommunityPost",
      entityId: post.id,
      metadata: { action: "created" },
    });

    return flatten(post);
  },

  async addComment(userId: string, postId: string, content: string) {
    const clean = stripHtml(content).trim();
    if (!clean) throw new ValidationError("Comment cannot be empty.");

    const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new NotFoundError("Post");

    return prisma.communityComment.create({
      data: { userId, postId, content: clean },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
      },
    });
  },

  /** Toggles a like — returns the new state so the UI can update once. */
  async toggleLike(userId: string, postId: string) {
    const existing = await prisma.communityLike.findFirst({ where: { userId, postId } });

    if (existing) {
      await prisma.communityLike.delete({ where: { id: existing.id } });
      const count = await prisma.communityLike.count({ where: { postId } });
      return { liked: false, count };
    }

    await prisma.communityLike.create({ data: { userId, postId } });
    const count = await prisma.communityLike.count({ where: { postId } });
    return { liked: true, count };
  },

  async deletePost(userId: string, postId: string, isModerator: boolean) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { userId: true } });
    if (!post) throw new NotFoundError("Post");
    // Authors can remove their own posts; moderators can remove any.
    if (post.userId !== userId && !isModerator) {
      throw new ValidationError("You can only delete your own posts.");
    }
    await prisma.communityPost.delete({ where: { id: postId } });
    return { success: true };
  },
};
