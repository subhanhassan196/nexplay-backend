import { prisma } from "@/config/db";
import type { Prisma } from "@prisma/client";

export const profileRepository = {
  findByUserId(userId: string) {
    return prisma.profile.findUnique({ where: { userId } });
  },

  update(userId: string, data: Prisma.ProfileUpdateInput) {
    return prisma.profile.update({ where: { userId }, data });
  },

  updateAvatar(userId: string, avatarUrl: string) {
    return prisma.profile.update({ where: { userId }, data: { avatarUrl } });
  },

  updateBanner(userId: string, bannerUrl: string) {
    return prisma.profile.update({ where: { userId }, data: { bannerUrl } });
  },
};

export const userSettingsRepository = {
  findByUserId(userId: string) {
    return prisma.userSettings.findUnique({ where: { userId } });
  },

  update(userId: string, data: Prisma.UserSettingsUpdateInput) {
    return prisma.userSettings.update({ where: { userId }, data });
  },
};
