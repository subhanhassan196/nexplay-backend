import { seoRepository } from "@/repositories/seo.repository";
import type { Prisma } from "@prisma/client";

const DEFAULT_META = {
  title: "NexPlay — Play • Compete • Earn",
  description: "NexPlay is a premium gaming platform where players compete in tournaments, climb global leaderboards, and earn rewards.",
  keywords: ["gaming", "tournaments", "leaderboards", "esports", "nexplay"],
  ogTitle: null,
  ogDescription: null,
  ogImageUrl: null,
  twitterCard: "summary_large_image",
  canonicalUrl: null,
  robots: "index,follow",
  structuredData: null,
};

/**
 * SEO service. Public pages resolve their meta by path, falling back to
 * sensible site-wide defaults when no override exists — so every page is
 * indexable out of the box and fully editable from the admin panel.
 */
export const seoService = {
  async getForPath(path: string) {
    const meta = await seoRepository.getByPath(path);
    return meta ?? { path, ...DEFAULT_META };
  },

  list: () => seoRepository.list(),

  upsert: (path: string, data: Omit<Prisma.SeoMetaCreateInput, "path">) => seoRepository.upsert(path, data),

  remove: (path: string) => seoRepository.delete(path),

  /** Builds a sitemap-ready list of known paths with SEO entries. */
  async sitemapPaths() {
    const entries = await seoRepository.list();
    return entries.map((e: { path: string; updatedAt: Date }) => ({ path: e.path, updatedAt: e.updatedAt }));
  },
};
