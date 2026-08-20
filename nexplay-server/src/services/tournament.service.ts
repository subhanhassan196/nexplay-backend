import { prisma } from "@/config/db";
import { NotFoundError, ValidationError } from "@/errors";
import { cacheService } from "@/services/cache.service";
import { activityService, ACTIVITY_ACTIONS } from "@/services/activity.service";
import type { Prisma, TournamentStatus } from "@prisma/client";

/**
 * Tournament service. Every tournament card on the public site resolves
 * to a real record with a real slug, which is what fixes the previous
 * 404s — the listing and the detail page read the same table.
 *
 * Drafts are never exposed publicly; only PUBLISHED and later states.
 */
const PUBLIC_STATES: TournamentStatus[] = ["REGISTRATION_OPEN", "LIVE", "COMPLETED"];
const CACHE_TTL = 120;

const listSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  bannerUrl: true,
  status: true,
  format: true,
  maxParticipants: true,
  prizePoolCents: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  startsAt: true,
  endsAt: true,
  game: { select: { id: true, slug: true, title: true, coverImageUrl: true } },
  _count: { select: { participants: true } },
} satisfies Prisma.TournamentSelect;

export const tournamentService = {
  /** Public listing — published tournaments only. */
  async list(filters: { status?: TournamentStatus; gameSlug?: string } = {}) {
    const key = `tournaments:list:${filters.status ?? "all"}:${filters.gameSlug ?? "all"}`;
    return cacheService.remember(key, CACHE_TTL, () =>
      prisma.tournament.findMany({
        where: {
          status: filters.status ? { equals: filters.status } : { in: PUBLIC_STATES },
          ...(filters.gameSlug ? { game: { slug: filters.gameSlug } } : {}),
        },
        orderBy: [{ startsAt: "asc" }],
        select: listSelect,
      })
    );
  },

  /** Detail page by slug. 404s only for genuinely missing/draft records. */
  async getBySlug(slug: string) {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: {
        ...listSelect,
        rules: true,
        createdAt: true,
        updatedAt: true,
        participants: {
          select: {
            id: true,
            status: true,
            registeredAt: true,
            user: { select: { id: true, username: true, profile: { select: { avatarUrl: true } } } },
          },
          orderBy: { registeredAt: "asc" },
          take: 100,
        },
        results: {
          select: {
            placement: true,
            prizeAwardedCents: true,
            user: { select: { id: true, username: true } },
          },
          orderBy: { placement: "asc" },
        },
      },
    });

    if (!tournament || !PUBLIC_STATES.includes(tournament.status)) throw new NotFoundError("Tournament");
    return tournament;
  },

  /** Registers the current user, respecting capacity and window. */
  async register(userId: string, slug: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tournament = await tx.tournament.findUnique({
        where: { slug },
        select: { id: true, status: true, maxParticipants: true, registrationClosesAt: true },
      });
      if (!tournament) throw new NotFoundError("Tournament");
      if (tournament.status !== "REGISTRATION_OPEN") throw new ValidationError("Registration is not open.");
      if (tournament.registrationClosesAt && tournament.registrationClosesAt < new Date()) {
        throw new ValidationError("Registration has closed.");
      }

      const count = await tx.tournamentParticipant.count({ where: { tournamentId: tournament.id } });
      if (count >= tournament.maxParticipants) throw new ValidationError("This tournament is full.");

      const existing = await tx.tournamentParticipant.findUnique({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
      });
      if (existing) throw new ValidationError("You're already registered.");

      return tx.tournamentParticipant.create({
        data: { tournamentId: tournament.id, userId, status: "REGISTERED" },
      });
    });
  },

  // ── Admin ──
  async adminList() {
    return prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      select: { ...listSelect, rules: true, createdAt: true },
    });
  },

  async create(data: Prisma.TournamentUncheckedCreateInput, actorId?: string) {
    const tournament = await prisma.tournament.create({ data });
    await cacheService.invalidatePrefix("tournaments:");
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "Tournament",
      entityId: tournament.id,
      metadata: { action: "created", title: tournament.title },
    });
    return tournament;
  },

  async update(id: string, data: Prisma.TournamentUncheckedUpdateInput, actorId?: string) {
    const tournament = await prisma.tournament.update({ where: { id }, data });
    await cacheService.invalidatePrefix("tournaments:");
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "Tournament",
      entityId: id,
      metadata: { action: "updated", title: tournament.title },
    });
    return tournament;
  },

  async remove(id: string, actorId?: string) {
    await prisma.tournament.delete({ where: { id } });
    await cacheService.invalidatePrefix("tournaments:");
    void activityService.record({
      actorId,
      action: ACTIVITY_ACTIONS.ADMIN_ACTION,
      entityType: "Tournament",
      entityId: id,
      metadata: { action: "deleted" },
    });
    return { success: true };
  },
};
