import { gameRepository } from "@/repositories/game.repository";
import { prisma } from "@/config/db";
import { cacheService } from "@/services/cache.service";
import { NotFoundError } from "@/errors";
import { buildListQuery, buildSearchFilter, buildPaginationMeta, type ListQuery } from "@/utils/apiFeatures";
import type { Prisma } from "@prisma/client";

const GAME_SORT_FIELDS = ["title", "createdAt", "activePlayers", "averageRating"] as const;

export const gameService = {
  /**
   * Public headline counts for the homepage. Cheap COUNT queries behind
   * a short cache — real numbers, so the figures on the homepage always
   * match what the rest of the site shows.
   */
  publicStats() {
    return cacheService.remember("public:stats", 120, async () => {
      const [players, games, tournaments, messages] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.game.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
        prisma.tournament.count({ where: { status: { in: ["REGISTRATION_OPEN", "LIVE", "COMPLETED"] } } }),
        prisma.message.count(),
      ]);
      return { players, games, tournaments, messages };
    });
  },

  /**
   * Active categories with their game counts, cached briefly — the
   * catalog nav hits this on nearly every page.
   */
  listCategories() {
    return cacheService.remember("catalog:categories", 300, async () => {
      const categories = await prisma.gameCategory.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      });

      // Count published games per category with one grouped query rather
      // than a filtered relation count (which needs a Prisma preview flag).
      const counts = await prisma.game.groupBy({
        by: ["categoryId"],
        where: { deletedAt: null, status: "PUBLISHED" },
        _count: { _all: true },
      });
      const countByCategory = new Map(
        counts.map((c: { categoryId: string | null; _count: { _all: number } }) => [c.categoryId, c._count._all])
      );

      return categories.map((c: { id: string }) => ({
        ...c,
        _count: { games: (countByCategory.get(c.id) as number | undefined) ?? 0 },
      }));
    });
  },

  async list(query: ListQuery, filters: { category?: string; status?: string }) {
    const { skip, take, orderBy } = buildListQuery(query, GAME_SORT_FIELDS, "createdAt");

    const where: Prisma.GameWhereInput = {
      status: (filters.status as Prisma.GameWhereInput["status"]) ?? "PUBLISHED",
      ...(filters.category ? { category: { slug: filters.category } } : {}),
      ...(buildSearchFilter(query.search, ["title", "description"]) ?? {}),
    };

    const [items, totalItems] = await Promise.all([
      gameRepository.findMany({ where, skip, take, orderBy }),
      gameRepository.count(where),
    ]);

    return { items, pagination: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }) };
  },

  async getBySlug(slug: string) {
    const game = await gameRepository.findBySlug(slug);
    if (!game) throw new NotFoundError("Game");
    return game;
  },
};
