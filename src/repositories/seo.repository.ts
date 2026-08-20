import { prisma } from "@/config/db";
import type { Prisma } from "@prisma/client";

export const seoRepository = {
  getByPath(path: string) {
    return prisma.seoMeta.findUnique({ where: { path } });
  },

  list() {
    return prisma.seoMeta.findMany({ orderBy: { path: "asc" } });
  },

  upsert(path: string, data: Omit<Prisma.SeoMetaCreateInput, "path">) {
    return prisma.seoMeta.upsert({
      where: { path },
      create: { path, ...data },
      update: data,
    });
  },

  delete(path: string) {
    return prisma.seoMeta.delete({ where: { path } });
  },
};
