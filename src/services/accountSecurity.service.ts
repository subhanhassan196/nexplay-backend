import { randomBytes } from "crypto";
import { prisma } from "@/config/db";
import { NotFoundError, ValidationError } from "@/errors";
import { logger } from "@/utils/logger";

/**
 * Account security and agent routing.
 *
 * The multi-account feature here surfaces *signals*, not verdicts. Two
 * accounts sharing an IP genuinely happens — shared households, offices,
 * university networks, mobile carrier NAT — so this tells an agent
 * "these accounts overlap, take a look" and stops there. It deliberately
 * does not block, merge or flag anything automatically, because acting on
 * a signal this weak would lock out legitimate users.
 */

/** A readable device label from a user-agent string. */
function describeDevice(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;
  const ua = userAgent.toLowerCase();

  const os = ua.includes("android")
    ? "Android"
    : /iphone|ipad|ios/.test(ua)
      ? "iOS"
      : ua.includes("windows")
        ? "Windows"
        : ua.includes("mac os")
          ? "macOS"
          : ua.includes("linux")
            ? "Linux"
            : "Unknown OS";

  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome")
      ? "Chrome"
      : ua.includes("firefox")
        ? "Firefox"
        : ua.includes("safari")
          ? "Safari"
          : "Browser";

  return `${browser} on ${os}`;
}

export const accountSecurityService = {
  /**
   * Records a sign-in attempt. Fire-and-forget by design — a logging
   * failure must never stop someone logging in.
   */
  async recordLogin(userId: string, opts: { ipAddress?: string; userAgent?: string; success?: boolean }) {
    try {
      await prisma.loginHistory.create({
        data: {
          userId,
          ipAddress: opts.ipAddress,
          userAgent: opts.userAgent?.slice(0, 400),
          device: describeDevice(opts.userAgent),
          success: opts.success ?? true,
        },
      });
    } catch (err) {
      logger.warn("Could not record login history", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  /** The customer's own recent sign-ins, so they can recognise their account. */
  getMyLoginHistory(userId: string, limit = 20) {
    return prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, ipAddress: true, device: true, success: true, createdAt: true },
    });
  },

  /**
   * Accounts that share sign-in origins with this one.
   *
   * Returns a confidence label rather than a boolean, and explains why —
   * an agent seeing "3 shared IPs, 2 shared devices" can judge whether
   * it's a family or a duplicate. A bare "SUSPICIOUS" flag would invite
   * acting on a coincidence.
   */
  async findRelatedAccounts(userId: string) {
    const ownLogins = await prisma.loginHistory.findMany({
      where: { userId, success: true },
      select: { ipAddress: true, device: true },
      take: 200,
    });

    type LoginRow = { ipAddress: string | null; device: string | null };
    const ownIps = new Set(ownLogins.map((l: LoginRow) => l.ipAddress).filter(Boolean) as string[]);
    const ownDevices = new Set(ownLogins.map((l: LoginRow) => l.device).filter(Boolean) as string[]);

    if (ownIps.size === 0) return { related: [], checkedIps: 0 };

    // Other accounts that logged in from any of the same addresses.
    const overlapping = await prisma.loginHistory.findMany({
      where: {
        userId: { not: userId },
        success: true,
        ipAddress: { in: [...ownIps] },
      },
      select: {
        userId: true,
        ipAddress: true,
        device: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            accountStatus: true,
            createdAt: true,
          },
        },
      },
      take: 500,
    });

    // Group by account and count distinct overlaps.
    const byUser = new Map<
      string,
      {
        user: { id: string; username: string; email: string; accountStatus: string; createdAt: Date };
        sharedIps: Set<string>;
        sharedDevices: Set<string>;
        lastSeen: Date;
      }
    >();

    for (const row of overlapping) {
      if (!row.user) continue;
      const entry = byUser.get(row.userId) ?? {
        user: row.user,
        sharedIps: new Set<string>(),
        sharedDevices: new Set<string>(),
        lastSeen: row.createdAt,
      };
      if (row.ipAddress) entry.sharedIps.add(row.ipAddress);
      if (row.device && ownDevices.has(row.device)) entry.sharedDevices.add(row.device);
      if (row.createdAt > entry.lastSeen) entry.lastSeen = row.createdAt;
      byUser.set(row.userId, entry);
    }

    const related = [...byUser.values()]
      .map((e) => {
        const ipCount = e.sharedIps.size;
        const deviceCount = e.sharedDevices.size;

        // Shared IP alone is common (households, carrier NAT). Adding a
        // matching device makes it more notable, but never conclusive.
        const confidence: "low" | "medium" | "high" =
          deviceCount > 0 && ipCount >= 2 ? "high" : deviceCount > 0 || ipCount >= 3 ? "medium" : "low";

        const reasons: string[] = [];
        reasons.push(`${ipCount} shared IP address${ipCount === 1 ? "" : "es"}`);
        if (deviceCount > 0) reasons.push(`${deviceCount} shared device${deviceCount === 1 ? "" : "s"}`);

        return {
          user: e.user,
          sharedIpCount: ipCount,
          sharedDeviceCount: deviceCount,
          confidence,
          reasons,
          lastSeenTogether: e.lastSeen,
        };
      })
      .sort((a, b) => b.sharedIpCount - a.sharedIpCount);

    return { related, checkedIps: ownIps.size };
  },

  // ── Agent links ──
  /** The agent's personal support link, created on first request. */
  async getOrCreateAgentLink(agentId: string) {
    const existing = await prisma.agentLink.findUnique({ where: { agentId } });
    if (existing) return existing;

    const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { username: true } });
    if (!agent) throw new NotFoundError("Agent");

    // Username base plus random suffix — readable, but not guessable, so
    // one agent's link can't be derived from another's.
    const base = agent.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "agent";
    const slug = `${base}-${randomBytes(3).toString("hex")}`;

    return prisma.agentLink.create({ data: { agentId, slug } });
  },

  listAgentLinks() {
    return prisma.agentLink.findMany({
      orderBy: { createdAt: "desc" },
      include: { agent: { select: { id: true, username: true, role: true } } },
    });
  },

  setAgentLinkActive(agentId: string, isActive: boolean) {
    return prisma.agentLink.update({ where: { agentId }, data: { isActive } });
  },

  /**
   * Resolves a public support link and pre-assigns the customer's
   * conversation to that agent.
   *
   * If the thread already has an agent, that assignment is kept — a link
   * shouldn't silently pull an active conversation away from whoever is
   * already handling it.
   */
  async claimViaLink(slug: string, userId: string) {
    const link = await prisma.agentLink.findUnique({
      where: { slug },
      include: { agent: { select: { id: true, username: true, accountStatus: true } } },
    });

    if (!link || !link.isActive) throw new NotFoundError("Support link");
    if (link.agent.accountStatus !== "ACTIVE") throw new ValidationError("That agent isn't available right now.");

    const conversation = await prisma.conversation.upsert({
      where: { userId },
      create: { userId, assignedAgentId: link.agentId },
      update: {},
    });

    if (!conversation.assignedAgentId) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assignedAgentId: link.agentId },
      });
    }

    await prisma.agentLink.update({ where: { id: link.id }, data: { visitCount: { increment: 1 } } });

    return {
      agent: { username: link.agent.username },
      alreadyAssigned: Boolean(conversation.assignedAgentId) && conversation.assignedAgentId !== link.agentId,
    };
  },
};
