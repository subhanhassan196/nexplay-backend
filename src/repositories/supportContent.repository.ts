import { prisma } from "@/config/db";
import type { Prisma, QuickLinkCategory } from "@prisma/client";
import { SUPPORT_SETTING_DEFAULTS } from "@/constants/messenger";

export const quickLinkRepository = {
  listActive() {
    return prisma.quickLink.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { order: "asc" }],
    });
  },

  listAll() {
    return prisma.quickLink.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  },

  create(data: {
    category: QuickLinkCategory;
    label: string;
    url: string;
    iconName?: string;
    description?: string;
    order?: number;
  }) {
    return prisma.quickLink.create({ data });
  },

  update(id: string, data: Prisma.QuickLinkUpdateInput) {
    return prisma.quickLink.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.quickLink.delete({ where: { id } });
  },
};

export const announcementRepository = {
  listActive() {
    const now = new Date();
    return prisma.announcement.findMany({
      where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { publishedAt: "desc" },
    });
  },

  listAll() {
    return prisma.announcement.findMany({ orderBy: { publishedAt: "desc" } });
  },

  create(data: { title: string; body: string; expiresAt?: Date }) {
    return prisma.announcement.create({ data });
  },

  update(id: string, data: Prisma.AnnouncementUpdateInput) {
    return prisma.announcement.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.announcement.delete({ where: { id } });
  },
};

export const supportSettingRepository = {
  async getAll(): Promise<Record<string, string>> {
    const rows = await prisma.supportSetting.findMany();
    const stored = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    // Merge stored values over defaults so unset keys still resolve.
    return { ...SUPPORT_SETTING_DEFAULTS, ...stored };
  },

  upsert(key: string, value: string, updatedById?: string) {
    return prisma.supportSetting.upsert({
      where: { key },
      create: { key, value, updatedById },
      update: { value, updatedById },
    });
  },
};
