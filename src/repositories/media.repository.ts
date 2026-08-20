import { prisma } from "@/config/db";
import type { Prisma } from "@prisma/client";

export const mediaRepository = {
  create(data: Prisma.MediaAssetCreateInput) {
    return prisma.mediaAsset.create({ data });
  },

  list(args: { where: Prisma.MediaAssetWhereInput; skip: number; take: number }) {
    return prisma.mediaAsset.findMany({
      where: args.where,
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
    });
  },

  count(where: Prisma.MediaAssetWhereInput) {
    return prisma.mediaAsset.count({ where });
  },

  findById(id: string) {
    return prisma.mediaAsset.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.MediaAssetUpdateInput) {
    return prisma.mediaAsset.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.mediaAsset.delete({ where: { id } });
  },

  /** Distinct folder names for the folder sidebar. */
  async folders() {
    const rows = await prisma.mediaAsset.findMany({
      distinct: ["folder"],
      select: { folder: true },
      orderBy: { folder: "asc" },
    });
    return rows.map((r: { folder: string }) => r.folder);
  },
};
