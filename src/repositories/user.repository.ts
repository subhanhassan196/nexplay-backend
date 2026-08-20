import { prisma } from "@/config/db";
import type { Prisma } from "@prisma/client";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  },

  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, include: { profile: true } });
  },

  findByEmailOrUsername(email: string, username: string) {
    return prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username }] },
    });
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  },

  markEmailVerified(id: string) {
    return prisma.user.update({ where: { id }, data: { isEmailVerified: true } });
  },

  incrementFailedAttempts(id: string) {
    return prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  },

  resetFailedAttempts(id: string) {
    return prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  },

  lockAccount(id: string, until: Date) {
    return prisma.user.update({ where: { id }, data: { lockedUntil: until } });
  },

  updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
  },
};
