import { prisma } from "@/config/db";
import type { Prisma, BannerPlacement } from "@prisma/client";

/**
 * CMS data access. Covers keyed site content, banners, and legal pages.
 * FAQ has its own long-standing table/repository and is reused as-is.
 */
export const cmsRepository = {
  // ── Site content (keyed JSON blocks) ──
  getContent(key: string) {
    return prisma.siteContent.findUnique({ where: { key } });
  },

  listContent() {
    return prisma.siteContent.findMany({ orderBy: { key: "asc" } });
  },

  upsertContent(key: string, value: Prisma.InputJsonValue, updatedById?: string) {
    return prisma.siteContent.upsert({
      where: { key },
      create: { key, value, updatedById },
      update: { value, updatedById },
    });
  },

  deleteContent(key: string) {
    return prisma.siteContent.delete({ where: { key } });
  },

  // ── Banners ──
  listBanners(placement?: BannerPlacement, activeOnly?: boolean) {
    const now = new Date();
    return prisma.banner.findMany({
      where: {
        ...(placement ? { placement } : {}),
        ...(activeOnly
          ? {
              isActive: true,
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ placement: "asc" }, { order: "asc" }],
    });
  },

  createBanner(data: Prisma.BannerCreateInput) {
    return prisma.banner.create({ data });
  },

  updateBanner(id: string, data: Prisma.BannerUpdateInput) {
    return prisma.banner.update({ where: { id }, data });
  },

  deleteBanner(id: string) {
    return prisma.banner.delete({ where: { id } });
  },

  // ── Legal pages ──
  getLegalPage(slug: string) {
    return prisma.legalPage.findUnique({ where: { slug } });
  },

  listLegalPages(publishedOnly?: boolean) {
    return prisma.legalPage.findMany({
      where: publishedOnly ? { isPublished: true } : {},
      orderBy: { slug: "asc" },
    });
  },

  upsertLegalPage(slug: string, data: { title: string; body: string; isPublished?: boolean; updatedById?: string }) {
    return prisma.legalPage.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
  },

  deleteLegalPage(slug: string) {
    return prisma.legalPage.delete({ where: { slug } });
  },
};
