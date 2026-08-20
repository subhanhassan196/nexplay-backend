import { prisma } from "@/config/db";
import type { Prisma } from "@prisma/client";

const actorSelect = { select: { id: true, username: true, role: true } };

export const activityRepository = {
  log(data: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
  }) {
    return prisma.auditLog.create({ data });
  },

  list(args: { where: Prisma.AuditLogWhereInput; skip: number; take: number }) {
    return prisma.auditLog.findMany({
      where: args.where,
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
      include: { actor: actorSelect },
    });
  },

  count(where: Prisma.AuditLogWhereInput) {
    return prisma.auditLog.count({ where });
  },
};
