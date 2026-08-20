import { cmsRepository } from "@/repositories/cms.repository";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import { cacheService } from "@/services/cache.service";
import { prisma } from "@/config/db";
import { NotFoundError } from "@/errors";
import type { Prisma, BannerPlacement } from "@prisma/client";

const CONTENT_CACHE_TTL = 600; // 10 minutes — content changes rarely

/**
 * CMS service — the single source of truth for editable site content.
 * Every public page that needs editable copy/imagery reads through the
 * `content`, `banners`, `legal`, and `faq` sections here. All writes are
 * audit-logged so the Activity Center reflects content changes.
 */
export const cmsService = {
  // ── Keyed content blocks ──
  content: {
    get: (key: string) =>
      cacheService.remember(`cms:content:${key}`, CONTENT_CACHE_TTL, () => cmsRepository.getContent(key)),
    list: () => cmsRepository.listContent(),
    async set(key: string, value: Prisma.InputJsonValue, actorId?: string) {
      const result = await cmsRepository.upsertContent(key, value, actorId);
      await cacheService.del(`cms:content:${key}`); // bust cache on write
      void activityService.record({
        actorId,
        action: ACTIVITY_ACTIONS.SETTINGS_CHANGED,
        entityType: "SiteContent",
        entityId: key,
      });
      return result;
    },
    async remove(key: string) {
      await cacheService.del(`cms:content:${key}`);
      return cmsRepository.deleteContent(key);
    },
  },

  // ── Banners ──
  banners: {
    list: (placement?: BannerPlacement, activeOnly?: boolean) => cmsRepository.listBanners(placement, activeOnly),
    create: (data: Prisma.BannerCreateInput) => cmsRepository.createBanner(data),
    update: (id: string, data: Prisma.BannerUpdateInput) => cmsRepository.updateBanner(id, data),
    remove: (id: string) => cmsRepository.deleteBanner(id),
  },

  // ── Legal / info pages ──
  legal: {
    async get(slug: string) {
      const page = await cmsRepository.getLegalPage(slug);
      if (!page) throw new NotFoundError("Page");
      return page;
    },
    list: (publishedOnly?: boolean) => cmsRepository.listLegalPages(publishedOnly),
    async upsert(slug: string, data: { title: string; body: string; isPublished?: boolean }, actorId?: string) {
      const result = await cmsRepository.upsertLegalPage(slug, { ...data, updatedById: actorId });
      void activityService.record({
        actorId,
        action: ACTIVITY_ACTIONS.SETTINGS_CHANGED,
        entityType: "LegalPage",
        entityId: slug,
      });
      return result;
    },
    remove: (slug: string) => cmsRepository.deleteLegalPage(slug),
  },

  // ── FAQ (reuses the long-standing faqs table) ──
  faq: {
    list: (publishedOnly?: boolean) =>
      prisma.fAQ.findMany({
        where: publishedOnly ? { isPublished: true } : {},
        orderBy: [{ category: "asc" }, { order: "asc" }],
      }),
    create: (data: { question: string; answer: string; category?: string; order?: number }) =>
      prisma.fAQ.create({ data }),
    update: (id: string, data: Prisma.FAQUpdateInput) => prisma.fAQ.update({ where: { id }, data }),
    remove: (id: string) => prisma.fAQ.delete({ where: { id } }),
  },
};
