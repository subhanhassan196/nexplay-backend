import { prisma } from "@/config/db";

/**
 * Reporting service for the admin dashboard. Aggregates support metrics:
 * ticket volume over time, resolution stats, category/priority breakdowns,
 * and per-agent performance. All queries are read-only and scoped to a
 * date range so the reports page can offer 7/30/90-day windows.
 */
function sinceDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export const reportingService = {
  /** Headline KPI cards: totals, open/resolved, avg resolution time. */
  async overview(days: number) {
    const since = sinceDate(days);

    const [total, open, pending, resolved, archived, newInRange, resolvedInRange] = await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.count({ where: { state: "OPEN" } }),
      prisma.conversation.count({ where: { state: "PENDING" } }),
      prisma.conversation.count({ where: { state: "RESOLVED" } }),
      prisma.conversation.count({ where: { state: "ARCHIVED" } }),
      prisma.conversation.count({ where: { createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { resolvedAt: { gte: since } } }),
    ]);

    // Average resolution time (hours) for tickets resolved in the range.
    const resolvedTickets = await prisma.conversation.findMany({
      where: { resolvedAt: { gte: since, not: null } },
      select: { createdAt: true, resolvedAt: true },
    });
    let avgResolutionHours = 0;
    if (resolvedTickets.length) {
      const totalMs = resolvedTickets.reduce((sum: number, t: { createdAt: Date; resolvedAt: Date | null }) => {
        if (!t.resolvedAt) return sum;
        return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
      }, 0);
      avgResolutionHours = Math.round((totalMs / resolvedTickets.length / (1000 * 60 * 60)) * 10) / 10;
    }

    // Total messages + how many were agent replies (support workload).
    const [totalMessages, agentMessages] = await Promise.all([
      prisma.message.count({ where: { createdAt: { gte: since } } }),
      prisma.message.count({ where: { createdAt: { gte: since }, senderType: "AGENT" } }),
    ]);

    return {
      total,
      open,
      pending,
      resolved,
      archived,
      newInRange,
      resolvedInRange,
      avgResolutionHours,
      totalMessages,
      agentMessages,
    };
  },

  /** Daily ticket-created + resolved counts for the trend chart. */
  async trends(days: number) {
    const since = sinceDate(days);
    const [created, resolved] = await Promise.all([
      prisma.conversation.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.conversation.findMany({
        where: { resolvedAt: { gte: since, not: null } },
        select: { resolvedAt: true },
      }),
    ]);

    // Bucket by day (YYYY-MM-DD).
    const buckets = new Map<string, { date: string; created: number; resolved: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, created: 0, resolved: 0 });
    }
    for (const c of created) {
      const key = c.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) b.created++;
    }
    for (const r of resolved) {
      if (!r.resolvedAt) continue;
      const key = r.resolvedAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) b.resolved++;
    }
    return Array.from(buckets.values());
  },

  /** Ticket count grouped by category + by priority (for pie/bar charts). */
  async breakdown() {
    const [byCategory, byPriority] = await Promise.all([
      prisma.conversation.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.conversation.groupBy({ by: ["priority"], _count: { _all: true } }),
    ]);
    return {
      byCategory: byCategory.map((c: { category: string; _count: { _all: number } }) => ({ label: c.category, count: c._count._all })),
      byPriority: byPriority.map((p: { priority: string; _count: { _all: number } }) => ({ label: p.priority, count: p._count._all })),
    };
  },

  /** Per-agent performance: replies sent + tickets resolved. */
  async agentPerformance(days: number) {
    const since = sinceDate(days);

    // Replies per agent.
    const replies = await prisma.message.groupBy({
      by: ["senderId"],
      where: { senderType: "AGENT", createdAt: { gte: since }, senderId: { not: null } },
      _count: { _all: true },
    });

    // Resolved tickets per assigned agent.
    const resolved = await prisma.conversation.groupBy({
      by: ["assignedAgentId"],
      where: { resolvedAt: { gte: since, not: null }, assignedAgentId: { not: null } },
      _count: { _all: true },
    });

    // Collect agent ids + names.
    const agentIds = Array.from(
      new Set([
        ...replies.map((r: { senderId: string | null }) => r.senderId).filter(Boolean),
        ...resolved.map((r: { assignedAgentId: string | null }) => r.assignedAgentId).filter(Boolean),
      ])
    ) as string[];

    if (agentIds.length === 0) return [];

    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, username: true },
    });
    const nameById = new Map(agents.map((a: { id: string; username: string }) => [a.id, a.username]));
    const replyById = new Map(replies.map((r: { senderId: string | null; _count: { _all: number } }) => [r.senderId, r._count._all]));
    const resolvedById = new Map(
      resolved.map((r: { assignedAgentId: string | null; _count: { _all: number } }) => [r.assignedAgentId, r._count._all])
    );

    return agentIds
      .map((id) => ({
        agentId: id,
        username: nameById.get(id) ?? "Unknown",
        replies: (replyById.get(id) as number | undefined) ?? 0,
        resolved: (resolvedById.get(id) as number | undefined) ?? 0,
      }))
      .sort((a, b) => b.replies - a.replies);
  },
};
