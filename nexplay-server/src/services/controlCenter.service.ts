import { prisma } from "@/config/db";
import { healthService } from "@/services/health.service";
import { jobQueue } from "@/jobs/queue";

/**
 * NexPlay Control Center.
 *
 * A single call that answers "is the platform healthy and what's
 * happening right now" — counts that matter operationally rather than
 * vanity metrics. Everything is derived from live tables; nothing here
 * is estimated or hardcoded.
 */
export const controlCenterService = {
  async snapshot() {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Each probe is settled independently: a dashboard is most useful
    // exactly when something is broken, so one failing query degrades
    // its own tile rather than returning a 500 for the whole page.
    const results = await Promise.allSettled([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: dayAgo } } }),
      prisma.session.count({ where: { expiresAt: { gte: new Date() } } }),
      prisma.conversation.count({ where: { state: "OPEN" } }),
      prisma.conversation.count({ where: { state: "PENDING" } }),
      // Threads whose most recent message came from the user — i.e. still
      // waiting on support. This is the number an agent actually acts on.
      prisma.conversation.count({
        where: { state: { in: ["OPEN", "PENDING"] }, assignedAgentId: null },
      }),
      prisma.message.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.game.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
      prisma.tournament.count({ where: { status: "LIVE" } }),
      prisma.tournament.count({ where: { status: "REGISTRATION_OPEN" } }),
      prisma.wheelSpin.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.storeRedemption.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.coinWallet.aggregate({ _sum: { balance: true } }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: weekAgo } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: { select: { id: true, username: true, role: true } } },
      }),
      healthService.check(),
    ]);

    const degraded: string[] = [];
    const NAMES = [
      "users", "newUsers", "sessions", "openConversations", "pendingConversations",
      "unassigned", "messages", "games", "liveTournaments", "openTournaments",
      "spins", "redemptions", "coins", "adminActions", "health",
    ];

    function at<T>(index: number, fallback: T): T {
      const r = results[index];
      if (r.status === "fulfilled") return r.value as T;
      degraded.push(NAMES[index]);
      return fallback;
    }

    const totalUsers = at(0, 0);
    const newUsers24h = at(1, 0);
    const activeSessions = at(2, 0);
    const openConversations = at(3, 0);
    const pendingConversations = at(4, 0);
    const unansweredCount = at(5, 0);
    const messages24h = at(6, 0);
    const publishedGames = at(7, 0);
    const liveTournaments = at(8, 0);
    const openTournaments = at(9, 0);
    const spins24h = at(10, 0);
    const redemptions24h = at(11, 0);
    const coinsInCirculation = at<{ _sum: { balance: number | null } }>(12, { _sum: { balance: 0 } });
    const recentAdminActions = at<unknown[]>(13, []);
    const health = at<{
      status: string;
      uptime: number;
      environment: string;
      checks: Record<string, { status: string; latencyMs?: number; detail?: string }>;
    }>(14, {
      status: "unhealthy",
      uptime: Math.round(process.uptime()),
      environment: process.env.NODE_ENV ?? "development",
      checks: {},
    });

    // Surface anything an operator should act on, rather than making
    // them read the numbers and work it out.
    const alerts: { level: "warning" | "critical"; message: string }[] = [];
    if (health.status !== "healthy") alerts.push({ level: "critical", message: "A required dependency is down." });
    if (unansweredCount > 10) alerts.push({ level: "warning", message: `${unansweredCount} conversations are unassigned.` });
    if (jobQueue.pending > 50) alerts.push({ level: "warning", message: `${jobQueue.pending} background jobs are queued.` });
    if (publishedGames === 0) alerts.push({ level: "warning", message: "No games are published — the catalog is empty." });
    if (degraded.length > 0) {
      // Usually means a migration hasn't been applied yet — surface it
      // plainly instead of showing zeros that look like real numbers.
      alerts.push({
        level: "critical",
        message: `Some metrics couldn't be read (${degraded.join(", ")}). Run "npm run setup" if the schema is out of date.`,
      });
    }

    return {
      users: { total: totalUsers, new24h: newUsers24h, activeSessions },
      support: {
        open: openConversations,
        pending: pendingConversations,
        unassigned: unansweredCount,
        messages24h,
      },
      catalog: { publishedGames, liveTournaments, openTournaments },
      economy: {
        spins24h,
        redemptions24h,
        coinsInCirculation: coinsInCirculation._sum.balance ?? 0,
      },
      system: {
        status: health.status,
        uptime: health.uptime,
        environment: health.environment,
        checks: health.checks,
        queuePending: jobQueue.pending,
      },
      recentAdminActions,
      alerts,
      generatedAt: new Date().toISOString(),
    };
  },
};
