import { prisma } from "@/config/db";
import { NotFoundError, ValidationError, ForbiddenError } from "@/errors";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import { stripHtml } from "@/helpers/sanitize";
import type { Prisma } from "@prisma/client";

/**
 * Community feed — posts, comments and likes are all real records.
 *
 * Two rules run through everything here:
 *
 *  1. Ownership is checked on the server, every time. A crafted request
 *     with someone else's post id gets a 403, not a successful edit —
 *     hiding the button in the UI is not a security boundary.
 *  2. All user text is stripped of markup on the way in. The frontend
 *     renders it as plain text, so this is defence-in-depth against
 *     stored XSS rather than the only line of defence.
 *
 * Deletes are soft: the row stays with `deletedAt` set, so moderators
 * keep an audit trail and a deleted comment doesn't orphan its replies.
 */
const MODERATOR_ROLES = ["MODERATOR", "ADMIN", "SUPER_ADMIN"];

/** Authors may edit their own words for a short window after posting. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const authorSelect = {
  select: { id: true, username: true, profile: { select: { avatarUrl: true } } },
} satisfies Prisma.UserDefaultArgs;

const postSelect = {
  id: true,
  content: true,
  mediaUrls: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userId: true,
  user: authorSelect,
  game: { select: { id: true, slug: true, title: true } },
  _count: { select: { comments: true, likes: true } },
} satisfies Prisma.CommunityPostSelect;

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userId: true,
  postId: true,
  parentCommentId: true,
  user: authorSelect,
  _count: { select: { likes: true, replies: true } },
} satisfies Prisma.CommunityCommentSelect;

type WithAuthor = { user: { profile: { avatarUrl: string | null } | null } };

/** Lifts avatarUrl out of the profile relation onto the author object. */
function flattenAuthor<T extends WithAuthor>(row: T) {
  const { user, ...rest } = row;
  const { profile, ...userRest } = user;
  return { ...rest, user: { ...userRest, avatarUrl: profile?.avatarUrl ?? null } };
}

/** Replaces the body of a soft-deleted row so clients never see the original. */
function maskDeleted<T extends { deletedAt: Date | null; content: string }>(row: T) {
  return row.deletedAt ? { ...row, content: "" } : row;
}

function isModerator(role: string) {
  return MODERATOR_ROLES.includes(role);
}

/** Throws unless the actor owns the row or is a moderator. */
function assertCanModify(ownerId: string, actorId: string, actorRole: string, what: string) {
  if (ownerId === actorId) return;
  if (isModerator(actorRole)) return;
  throw new ForbiddenError(`You can only ${what} your own content.`);
}

export const communityService = {
  // ── Posts ──
  async listPosts(args: { skip?: number; take?: number; gameSlug?: string; authorId?: string }) {
    const where: Prisma.CommunityPostWhereInput = {
      deletedAt: null,
      ...(args.gameSlug ? { game: { slug: args.gameSlug } } : {}),
      ...(args.authorId ? { userId: args.authorId } : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: args.skip ?? 0,
        take: args.take ?? 20,
        select: postSelect,
      }),
      prisma.communityPost.count({ where }),
    ]);

    return { posts: posts.map(flattenAuthor), total };
  },

  async getPost(id: string) {
    const post = await prisma.communityPost.findFirst({
      where: { id, deletedAt: null },
      select: postSelect,
    });
    if (!post) throw new NotFoundError("Post");
    return flattenAuthor(post);
  },

  /** Which posts the viewer has already liked — powers the filled heart. */
  async likedPostIds(userId: string, postIds: string[]) {
    if (postIds.length === 0) return [];
    const likes = await prisma.communityLike.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    return likes.map((l: { postId: string | null }) => l.postId).filter(Boolean) as string[];
  },

  async createPost(userId: string, data: { content: string; gameId?: string; mediaUrls?: string[] }) {
    const content = stripHtml(data.content).trim();
    if (!content) throw new ValidationError("Post content is required.");
    if (content.length > 5000) throw new ValidationError("Post is too long (max 5000 characters).");

    const post = await prisma.communityPost.create({
      data: { userId, content, gameId: data.gameId, mediaUrls: data.mediaUrls ?? [] },
      select: postSelect,
    });
    return flattenAuthor(post);
  },

  async updatePost(actorId: string, actorRole: string, postId: string, content: string) {
    const existing = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { userId: true, createdAt: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) throw new NotFoundError("Post");
    assertCanModify(existing.userId, actorId, actorRole, "edit");

    // Moderators can correct content at any time; authors get a window,
    // so a post can't be quietly rewritten long after people replied to it.
    if (existing.userId === actorId && !isModerator(actorRole)) {
      if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
        throw new ValidationError("Posts can only be edited within 15 minutes of posting.");
      }
    }

    const clean = stripHtml(content).trim();
    if (!clean) throw new ValidationError("Post content is required.");

    const post = await prisma.communityPost.update({
      where: { id: postId },
      data: { content: clean },
      select: postSelect,
    });
    return flattenAuthor(post);
  },

  /**
   * Soft-deletes a post. The row survives so moderators keep the audit
   * trail and comment threads don't vanish mid-conversation.
   */
  async deletePost(actorId: string, actorRole: string, postId: string, reason?: string) {
    const existing = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { userId: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) throw new NotFoundError("Post");
    assertCanModify(existing.userId, actorId, actorRole, "delete");

    await prisma.communityPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });

    // Only log moderator removals — a user tidying up their own feed
    // isn't a moderation event and would just add noise.
    if (existing.userId !== actorId) {
      void activityService.record({
        actorId,
        action: ACTIVITY_ACTIONS.ADMIN_ACTION,
        entityType: "CommunityPost",
        entityId: postId,
        metadata: { action: "post_removed", authorId: existing.userId, reason: reason ?? null },
      });
    }

    return { success: true };
  },

  async restorePost(actorId: string, postId: string) {
    const post = await prisma.communityPost.update({
      where: { id: postId },
      data: { deletedAt: null },
      select: postSelect,
    });
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "CommunityPost",
      entityId: postId,
      metadata: { action: "post_restored" },
    });
    return flattenAuthor(post);
  },

  // ── Comments ──
  /**
   * Top-level comments for a post, each with a small preview of replies.
   * Paginated — a busy thread shouldn't ship hundreds of rows at once.
   */
  async listComments(postId: string, args: { skip?: number; take?: number } = {}) {
    const where: Prisma.CommunityCommentWhereInput = { postId, parentCommentId: null };

    const [comments, total] = await Promise.all([
      prisma.communityComment.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: args.skip ?? 0,
        take: args.take ?? 20,
        select: {
          ...commentSelect,
          replies: {
            orderBy: { createdAt: "asc" },
            take: 3,
            select: commentSelect,
          },
        },
      }),
      prisma.communityComment.count({ where }),
    ]);

    type Row = WithAuthor & { deletedAt: Date | null; content: string };
    const shaped = comments.map((c: Row & { replies?: Row[] }) => ({
      ...flattenAuthor(maskDeleted(c)),
      replies: (c.replies ?? []).map((r: Row) => flattenAuthor(maskDeleted(r))),
    }));

    return { comments: shaped, total };
  },

  async addComment(userId: string, postId: string, content: string, parentCommentId?: string) {
    const clean = stripHtml(content).trim();
    if (!clean) throw new ValidationError("Comment cannot be empty.");
    if (clean.length > 2000) throw new ValidationError("Comment is too long (max 2000 characters).");

    const post = await prisma.communityPost.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!post) throw new NotFoundError("Post");

    // A reply must belong to the same post, or threads could be spliced
    // across posts by passing an unrelated parent id.
    if (parentCommentId) {
      const parent = await prisma.communityComment.findUnique({
        where: { id: parentCommentId },
        select: { postId: true },
      });
      if (!parent || parent.postId !== postId) throw new ValidationError("Invalid parent comment.");
    }

    const comment = await prisma.communityComment.create({
      data: { userId, postId, content: clean, parentCommentId },
      select: commentSelect,
    });

    return flattenAuthor(comment);
  },

  async updateComment(actorId: string, actorRole: string, commentId: string, content: string) {
    const existing = await prisma.communityComment.findUnique({
      where: { id: commentId },
      select: { userId: true, createdAt: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) throw new NotFoundError("Comment");
    assertCanModify(existing.userId, actorId, actorRole, "edit");

    if (existing.userId === actorId && !isModerator(actorRole)) {
      if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
        throw new ValidationError("Comments can only be edited within 15 minutes.");
      }
    }

    const clean = stripHtml(content).trim();
    if (!clean) throw new ValidationError("Comment cannot be empty.");

    const comment = await prisma.communityComment.update({
      where: { id: commentId },
      data: { content: clean },
      select: commentSelect,
    });
    return flattenAuthor(comment);
  },

  /** Soft-delete, so replies keep their place in the thread. */
  async deleteComment(actorId: string, actorRole: string, commentId: string) {
    const existing = await prisma.communityComment.findUnique({
      where: { id: commentId },
      select: { userId: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) throw new NotFoundError("Comment");
    assertCanModify(existing.userId, actorId, actorRole, "delete");

    await prisma.communityComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });

    if (existing.userId !== actorId) {
      void activityService.record({
        actorId,
        action: ACTIVITY_ACTIONS.ADMIN_ACTION,
        entityType: "CommunityComment",
        entityId: commentId,
        metadata: { action: "comment_removed", authorId: existing.userId },
      });
    }

    return { success: true };
  },

  // ── Likes ──
  /** Toggles a like and returns the new state, so the UI updates once. */
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

  async toggleCommentLike(userId: string, commentId: string) {
    const existing = await prisma.communityLike.findFirst({ where: { userId, commentId } });

    if (existing) {
      await prisma.communityLike.delete({ where: { id: existing.id } });
      const count = await prisma.communityLike.count({ where: { commentId } });
      return { liked: false, count };
    }

    await prisma.communityLike.create({ data: { userId, commentId } });
    const count = await prisma.communityLike.count({ where: { commentId } });
    return { liked: true, count };
  },

  // ── Moderation ──
  /** Admin view: includes soft-deleted rows so removals stay inspectable. */
  async adminListPosts(args: { skip?: number; take?: number; search?: string; includeDeleted?: boolean }) {
    const where: Prisma.CommunityPostWhereInput = {
      ...(args.includeDeleted ? {} : { deletedAt: null }),
      ...(args.search
        ? {
            OR: [
              { content: { contains: args.search, mode: "insensitive" } },
              { user: { username: { contains: args.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: args.skip ?? 0,
        take: args.take ?? 30,
        select: postSelect,
      }),
      prisma.communityPost.count({ where }),
    ]);

    return { posts: posts.map(flattenAuthor), total };
  },
};
