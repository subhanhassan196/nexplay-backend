import { prisma } from "@/config/db";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import type { Prisma } from "@prisma/client";

/**
 * Admin-side rewards configuration. Everything the public rewards page
 * renders — wheel slices, the daily ladder, the store catalogue — is
 * written through here, so prizes can change without a deploy.
 */
function log(actorId: string | undefined, entityType: string, entityId: string, action: string, meta?: Prisma.InputJsonValue) {
  void activityService.record({
    actorId,
    action: ACTIVITY_ACTIONS.ADMIN_ACTION,
    entityType,
    entityId,
    metadata: { action, ...(typeof meta === "object" && meta !== null ? meta : {}) } as Prisma.InputJsonValue,
  });
}

export const adminRewardsService = {
  // ── Wheel ──
  listSegments() {
    return prisma.wheelSegment.findMany({ orderBy: { order: "asc" } });
  },

  async createSegment(data: Prisma.WheelSegmentCreateInput, actorId?: string) {
    const segment = await prisma.wheelSegment.create({ data });
    log(actorId, "WheelSegment", segment.id, "created", { label: segment.label });
    return segment;
  },

  async updateSegment(id: string, data: Prisma.WheelSegmentUpdateInput, actorId?: string) {
    const segment = await prisma.wheelSegment.update({ where: { id }, data });
    log(actorId, "WheelSegment", id, "updated", { label: segment.label });
    return segment;
  },

  async deleteSegment(id: string, actorId?: string) {
    // Past spins reference segments, so removing one that's been won
    // would orphan history — deactivate instead of deleting in that case.
    const spins = await prisma.wheelSpin.count({ where: { segmentId: id } });
    if (spins > 0) {
      const segment = await prisma.wheelSegment.update({ where: { id }, data: { isActive: false } });
      log(actorId, "WheelSegment", id, "deactivated", { reason: "has spin history" });
      return segment;
    }
    await prisma.wheelSegment.delete({ where: { id } });
    log(actorId, "WheelSegment", id, "deleted");
    return { id };
  },

  // ── Daily ladder ──
  listDailyConfig() {
    return prisma.dailyRewardConfig.findMany({ orderBy: { dayNumber: "asc" } });
  },

  async upsertDailyConfig(dayNumber: number, data: Omit<Prisma.DailyRewardConfigCreateInput, "dayNumber">, actorId?: string) {
    const config = await prisma.dailyRewardConfig.upsert({
      where: { dayNumber },
      create: { dayNumber, ...data },
      update: data,
    });
    log(actorId, "DailyRewardConfig", config.id, "saved", { dayNumber });
    return config;
  },

  async deleteDailyConfig(id: string, actorId?: string) {
    await prisma.dailyRewardConfig.delete({ where: { id } });
    log(actorId, "DailyRewardConfig", id, "deleted");
    return { success: true };
  },

  // ── Store ──
  listStoreItems() {
    return prisma.storeItem.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] });
  },

  async createStoreItem(data: Prisma.StoreItemCreateInput, actorId?: string) {
    const item = await prisma.storeItem.create({ data });
    log(actorId, "StoreItem", item.id, "created", { name: item.name });
    return item;
  },

  async updateStoreItem(id: string, data: Prisma.StoreItemUpdateInput, actorId?: string) {
    const item = await prisma.storeItem.update({ where: { id }, data });
    log(actorId, "StoreItem", id, "updated", { name: item.name });
    return item;
  },

  async deleteStoreItem(id: string, actorId?: string) {
    // Keep items that have been redeemed so redemption history stays
    // readable; deactivate them instead.
    const redemptions = await prisma.storeRedemption.count({ where: { itemId: id } });
    if (redemptions > 0) {
      const item = await prisma.storeItem.update({ where: { id }, data: { isActive: false } });
      log(actorId, "StoreItem", id, "deactivated", { reason: "has redemption history" });
      return item;
    }
    await prisma.storeItem.delete({ where: { id } });
    log(actorId, "StoreItem", id, "deleted");
    return { id };
  },

  /** Recent redemptions across all users — useful for spotting abuse. */
  recentRedemptions(limit = 50) {
    return prisma.storeRedemption.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        item: { select: { id: true, name: true, rarity: true } },
        user: { select: { id: true, username: true } },
      },
    });
  },
};
