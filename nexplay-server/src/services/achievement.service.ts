import { achievementRepository } from "@/repositories/gameEngine.repository";
import { notificationRepository } from "@/repositories/notification.repository";
import { xpService } from "@/services/xp.service";
import { logger } from "@/lib/logger";

export const achievementService = {
  /**
   * Unlocks an achievement for a user if they haven't already earned
   * it. Safe to call speculatively on every session-end — the unique
   * constraint on UserAchievement plus this existence check make it
   * naturally idempotent.
   */
  async unlockIfEligible(userId: string, achievementSlug: string) {
    const achievement = await achievementRepository.findBySlug(achievementSlug);
    if (!achievement) {
      logger.warn(`Achievement slug not found (seed may be out of date): ${achievementSlug}`);
      return null;
    }

    const alreadyUnlocked = await achievementRepository.hasUnlocked(userId, achievement.id);
    if (alreadyUnlocked) return null;

    await achievementRepository.unlock(userId, achievement.id);

    if (achievement.xpReward > 0) {
      await xpService.award(userId, achievement.xpReward, `achievement:${achievement.slug}`);
    }

    await notificationRepository.create(
      userId,
      "ACHIEVEMENT_UNLOCKED",
      "Achievement Unlocked!",
      achievement.name,
      { achievementId: achievement.id, slug: achievement.slug }
    );

    return achievement;
  },
};
