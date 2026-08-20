import { prisma } from "@/config/db";
import { NotFoundError } from "@/errors";
import { cacheService } from "@/services/cache.service";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import type { Prisma } from "@prisma/client";

/**
 * Admin game & category management. Everything the public catalog shows —
 * titles, art, categories, featured/trending flags, ordering — is written
 * through here, so nothing about the catalog is hardcoded in the frontend.
 *
 * Catalog reads are cached; every write busts the cache prefix.
 */
const CATALOG_CACHE_PREFIX = "catalog:";

async function bustCatalogCache() {
  await cacheService.invalidatePrefix(CATALOG_CACHE_PREFIX);
}

export const adminGameService = {
  // ── Games ──
  async listGames(filters: { search?: string; categoryId?: string; includeArchived?: boolean }) {
    return prisma.game.findMany({
      where: {
        ...(filters.includeArchived ? {} : { deletedAt: null }),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: "insensitive" } },
                { slug: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  },

  async getGame(id: string) {
    const game = await prisma.game.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!game) throw new NotFoundError("Game");
    return game;
  },

  async createGame(data: Prisma.GameCreateInput, actorId?: string) {
    const game = await prisma.game.create({ data });
    await bustCatalogCache();
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "Game",
      entityId: game.id,
      metadata: { action: "created", title: game.title },
    });
    return game;
  },

  async updateGame(id: string, data: Prisma.GameUpdateInput, actorId?: string) {
    const game = await prisma.game.update({ where: { id }, data });
    await bustCatalogCache();
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "Game",
      entityId: id,
      metadata: { action: "updated", title: game.title },
    });
    return game;
  },

  /** Soft-delete — preserves reviews/sessions/stats tied to the game. */
  async archiveGame(id: string, actorId?: string) {
    const game = await prisma.game.update({
      where: { id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    await bustCatalogCache();
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "Game",
      entityId: id,
      metadata: { action: "archived", title: game.title },
    });
    return game;
  },

  async restoreGame(id: string) {
    const game = await prisma.game.update({
      where: { id },
      data: { deletedAt: null, status: "PUBLISHED" },
    });
    await bustCatalogCache();
    return game;
  },

  /** Bulk reorder — accepts [{id, displayOrder}] from a drag-and-drop list. */
  async reorderGames(items: { id: string; displayOrder: number }[]) {
    await prisma.$transaction(
      items.map((item) => prisma.game.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } }))
    );
    await bustCatalogCache();
    return { count: items.length };
  },

  // ── Categories ──
  async listCategories(includeInactive?: boolean) {
    return prisma.gameCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { games: true } } },
    });
  },

  async createCategory(data: Prisma.GameCategoryCreateInput) {
    const category = await prisma.gameCategory.create({ data });
    await bustCatalogCache();
    return category;
  },

  async updateCategory(id: string, data: Prisma.GameCategoryUpdateInput) {
    const category = await prisma.gameCategory.update({ where: { id }, data });
    await bustCatalogCache();
    return category;
  },

  async deleteCategory(id: string) {
    // Games keep existing; their categoryId is set null by the schema's
    // onDelete: SetNull, so no game is ever destroyed with its category.
    await prisma.gameCategory.delete({ where: { id } });
    await bustCatalogCache();
    return { success: true };
  },

  async reorderCategories(items: { id: string; order: number }[]) {
    await prisma.$transaction(
      items.map((item) => prisma.gameCategory.update({ where: { id: item.id }, data: { order: item.order } }))
    );
    await bustCatalogCache();
    return { count: items.length };
  },

  /** Move a game into (or out of) a category. */
  async assignGameToCategory(gameId: string, categoryId: string | null) {
    const game = await prisma.game.update({ where: { id: gameId }, data: { categoryId } });
    await bustCatalogCache();
    return game;
  },
};
