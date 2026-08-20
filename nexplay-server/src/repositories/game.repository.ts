import { prisma } from "@/config/db";
import type { Prisma } from "@prisma/client";

export const gameRepository = {
  findBySlug(slug: string) {
    return prisma.game.findUnique({
      where: { slug },
      include: { category: true, developer: true, publisher: true, media: true },
    });
  },

  findMany(args: {
    where?: Prisma.GameWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.GameOrderByWithRelationInput;
  }) {
    return prisma.game.findMany({
      where: { ...args.where, deletedAt: null },
      skip: args.skip,
      take: args.take,
      orderBy: args.orderBy,
      include: { category: true },
    });
  },

  count(where?: Prisma.GameWhereInput) {
    return prisma.game.count({ where: { ...where, deletedAt: null } });
  },
};
