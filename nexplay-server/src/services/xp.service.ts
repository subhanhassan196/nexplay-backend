import { xpHistoryRepository } from "@/repositories/gameEngine.repository";

export const xpService = {
  async award(userId: string, amount: number, reason: string, metadata?: object) {
    if (amount === 0) return;
    await xpHistoryRepository.record(userId, amount, reason, metadata);
  },

  async getTotal(userId: string): Promise<number> {
    const result = await xpHistoryRepository.getTotalXP(userId);
    return result._sum.amount ?? 0;
  },
};
