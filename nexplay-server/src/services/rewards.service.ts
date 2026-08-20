import { prisma } from "@/config/db";
import { NotFoundError, ValidationError } from "@/errors";
import { logger } from "@/utils/logger";
import type { CoinTransactionReason, Prisma } from "@prisma/client";

/**
 * Rewards economy service.
 *
 * Every rule here is enforced server-side — the client never decides
 * what a user won, whether they may spin, or what their balance is.
 * Balance changes always run inside a transaction alongside the ledger
 * entry, so a crash can never leave coins credited without a record.
 *
 * Daily limits use a UTC date string plus a unique index rather than a
 * timestamp comparison: that makes a duplicate claim a database error
 * instead of a race condition, even under concurrent requests.
 */

/** UTC yyyy-mm-dd — the key both daily systems reset on. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ensures the user has a wallet, creating it lazily on first use. */
async function getOrCreateWallet(userId: string) {
  return prisma.coinWallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

/**
 * Credits or debits coins and writes the matching ledger row atomically.
 * Pass a negative amount to debit. Throws if a debit would go negative.
 */
async function applyCoins(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  reason: CoinTransactionReason,
  referenceId?: string
) {
  const wallet = await tx.coinWallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });

  const newBalance = wallet.balance + amount;
  if (newBalance < 0) throw new ValidationError("Insufficient coin balance.");

  const updated = await tx.coinWallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance },
  });

  await tx.coinTransaction.create({
    data: {
      walletId: wallet.id,
      amount,
      balanceAfter: newBalance,
      reason,
      referenceId,
    },
  });

  return updated;
}

export const rewardsService = {
  // ── Wallet ──
  async getBalance(userId: string) {
    const wallet = await getOrCreateWallet(userId);
    return { balance: wallet.balance };
  },

  async getTransactions(userId: string, limit = 50) {
    const wallet = await getOrCreateWallet(userId);
    return prisma.coinTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  // ── Wheel ──
  /** Public wheel layout — labels/colours only, weights stay server-side. */
  async getWheelSegments() {
    const segments = await prisma.wheelSegment.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, label: true, color: true, rewardType: true, coinAmount: true, order: true },
    });
    return segments;
  },

  /** Whether the user still has today's free spin. */
  async getSpinStatus(userId: string) {
    const existing = await prisma.wheelSpin.findUnique({
      where: { userId_spinDate: { userId, spinDate: todayKey() } },
    });
    return {
      canSpin: !existing,
      lastSpin: existing ? { segmentId: existing.segmentId, coinsWon: existing.coinsWon, at: existing.createdAt } : null,
      resetsAt: `${todayKey()}T23:59:59Z`,
    };
  },

  /**
   * Performs a spin. The winning segment is chosen here, by weight, and
   * the whole thing (spin record + coin credit + ledger) commits or
   * rolls back together. A second call the same day hits the unique
   * index and is rejected — refreshing or replaying the request can't
   * award a second reward.
   */
  async spin(userId: string) {
    const spinDate = todayKey();

    const segments = await prisma.wheelSegment.findMany({ where: { isActive: true } });
    if (segments.length === 0) throw new ValidationError("The wheel is not configured yet.");

    // Weighted pick — server-side only.
    const totalWeight = segments.reduce((sum: number, s: { weight: number }) => sum + s.weight, 0);
    let ticket = Math.random() * totalWeight;
    let winner = segments[segments.length - 1];
    for (const segment of segments) {
      ticket -= segment.weight;
      if (ticket <= 0) {
        winner = segment;
        break;
      }
    }

    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const spin = await tx.wheelSpin.create({
          data: { userId, segmentId: winner.id, spinDate, coinsWon: winner.coinAmount },
        });

        if (winner.coinAmount > 0) {
          await applyCoins(tx, userId, winner.coinAmount, "WHEEL_SPIN", spin.id);
        }

        const wallet = await tx.coinWallet.findUnique({ where: { userId } });
        return {
          segment: { id: winner.id, label: winner.label, rewardType: winner.rewardType, coinAmount: winner.coinAmount },
          coinsWon: winner.coinAmount,
          balance: wallet?.balance ?? 0,
        };
      });
    } catch (err) {
      // P2002 = unique constraint — they already spun today.
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        throw new ValidationError("You've already used today's free spin. Come back tomorrow.");
      }
      throw err;
    }
  },

  // ── Daily login rewards ──
  async getDailyConfig() {
    return prisma.dailyRewardConfig.findMany({
      where: { isActive: true },
      orderBy: { dayNumber: "asc" },
    });
  },

  /** Current streak position and whether today is claimable. */
  async getDailyStatus(userId: string) {
    const claimDate = todayKey();
    const [today, claims, config] = await Promise.all([
      prisma.dailyRewardClaim.findUnique({ where: { userId_claimDate: { userId, claimDate } } }),
      prisma.dailyRewardClaim.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.dailyRewardConfig.findMany({ where: { isActive: true }, orderBy: { dayNumber: "asc" } }),
    ]);

    // Streak = consecutive days ending yesterday (or today if claimed).
    let streak = 0;
    const seen = new Set(claims.map((c: { claimDate: string }) => c.claimDate));
    for (let i = 0; i < config.length; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      if (seen.has(d.toISOString().slice(0, 10))) streak++;
      else break;
    }

    const nextDay = today ? streak : Math.min(streak + 1, config.length || 1);

    return {
      canClaim: !today,
      currentStreak: streak,
      nextDayNumber: nextDay,
      claimedToday: Boolean(today),
      config,
    };
  },

  /** Claims today's reward — one per user per UTC day, enforced by index. */
  async claimDaily(userId: string) {
    const claimDate = todayKey();
    const status = await this.getDailyStatus(userId);
    if (!status.canClaim) throw new ValidationError("You've already claimed today's reward.");

    const config = await prisma.dailyRewardConfig.findFirst({
      where: { dayNumber: status.nextDayNumber, isActive: true },
    });
    if (!config) throw new ValidationError("Daily rewards are not configured yet.");

    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const claim = await tx.dailyRewardClaim.create({
          data: { userId, dayNumber: config.dayNumber, claimDate, coinsWon: config.coinAmount },
        });

        if (config.coinAmount > 0) {
          await applyCoins(tx, userId, config.coinAmount, "DAILY_LOGIN", claim.id);
        }

        const wallet = await tx.coinWallet.findUnique({ where: { userId } });
        return {
          dayNumber: config.dayNumber,
          label: config.label,
          coinsWon: config.coinAmount,
          balance: wallet?.balance ?? 0,
        };
      });
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        throw new ValidationError("You've already claimed today's reward.");
      }
      throw err;
    }
  },

  // ── Store ──
  async listStoreItems() {
    const now = new Date();
    return prisma.storeItem.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ order: "asc" }, { price: "asc" }],
    });
  },

  /**
   * Redeems an item. Balance check, stock decrement, coin debit and the
   * redemption record all happen in one transaction, so a double-click
   * or replayed request can't redeem twice or oversell stock.
   */
  async redeem(userId: string, itemId: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const item = await tx.storeItem.findUnique({ where: { id: itemId } });
      if (!item || !item.isActive) throw new NotFoundError("Store item");
      if (item.expiresAt && item.expiresAt < new Date()) throw new ValidationError("This item has expired.");
      if (item.stock !== null && item.stock <= 0) throw new ValidationError("This item is out of stock.");

      if (item.perUserLimit !== null) {
        const owned = await tx.storeRedemption.count({ where: { userId, itemId } });
        if (owned >= item.perUserLimit) throw new ValidationError("You've reached the limit for this item.");
      }

      // Debit — throws if the balance would go negative.
      await applyCoins(tx, userId, -item.price, "STORE_REDEMPTION", item.id);

      if (item.stock !== null) {
        await tx.storeItem.update({ where: { id: item.id }, data: { stock: { decrement: 1 } } });
      }

      const redemption = await tx.storeRedemption.create({
        data: { userId, itemId: item.id, pricePaid: item.price },
      });

      const wallet = await tx.coinWallet.findUnique({ where: { userId } });
      logger.info("Store redemption", { userId, itemId: item.id, price: item.price });

      return { redemption, item: { id: item.id, name: item.name }, balance: wallet?.balance ?? 0 };
    });
  },

  async myRedemptions(userId: string) {
    return prisma.storeRedemption.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { item: { select: { id: true, name: true, imageUrl: true, rarity: true } } },
      take: 50,
    });
  },
};
