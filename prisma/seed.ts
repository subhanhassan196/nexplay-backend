import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";


/**
 * Idempotent seed script — safe to run repeatedly against the same
 * database (uses `upsert` everywhere keyed on a natural unique field
 * like `slug` or `email`), so it can run in CI/CD on every deploy
 * without duplicating data.
 *
 * Run with: `npm run prisma:seed` (see package.json).
 */
const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@nexplay.gg";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username: "nexplay_admin",
      passwordHash,
      role: "SUPER_ADMIN",
      isEmailVerified: true,
      profile: { create: { displayName: "NexPlay Admin" } },
      settings: { create: {} },
    },
  });

  console.log(`✅ Admin user ready: ${admin.email} (${admin.role})`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`   ⚠️  Using default password "${password}" — override with SEED_ADMIN_PASSWORD in production.`);
  }
  return admin;
}

async function seedGameCategories() {
  const categories = [
    { slug: "card-games", name: "Card Games", iconName: "Layers", order: 1 },
    { slug: "table-games", name: "Table Games", iconName: "Dices", order: 2 },
    { slug: "instant-games", name: "Crash & Instant", iconName: "Zap", order: 3 },
    { slug: "number-games", name: "Lottery & Numbers", iconName: "Hash", order: 4 },
    { slug: "slots", name: "Slots", iconName: "Cherry", order: 5 },
  ];

  for (const category of categories) {
    await prisma.gameCategory.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }
  console.log(`✅ Seeded ${categories.length} game categories`);
  return prisma.gameCategory.findMany();
}

async function seedBadges() {
  const badges = [
    { slug: "founder", name: "Founder", description: "Joined NexPlay during its earliest days.", tier: "gold" },
    { slug: "first-win", name: "First Blood", description: "Won your first ranked match.", tier: "bronze" },
    { slug: "tournament-veteran", name: "Tournament Veteran", description: "Competed in 25 official tournaments.", tier: "silver" },
    { slug: "community-voice", name: "Community Voice", description: "Active, positive contributor to the community.", tier: "silver" },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({ where: { slug: badge.slug }, update: badge, create: badge });
  }
  console.log(`✅ Seeded ${badges.length} badges`);
}

async function seedAchievements() {
  const achievements = [
    { slug: "welcome-aboard", name: "Welcome Aboard", description: "Created a NexPlay account.", type: "MILESTONE" as const, xpReward: 50 },
    { slug: "win-streak-10", name: "Win Streak x10", description: "Win 10 ranked matches in a row.", type: "SKILL" as const, xpReward: 500 },
    { slug: "sharpshooter", name: "Sharpshooter", description: "Achieve 90%+ accuracy in a single match.", type: "SKILL" as const, xpReward: 250 },
    { slug: "social-butterfly", name: "Social Butterfly", description: "Add 10 friends.", type: "SOCIAL" as const, xpReward: 100 },
    { slug: "season-champion", name: "Season Champion", description: "Finish #1 on any seasonal leaderboard.", type: "SEASONAL" as const, xpReward: 1000 },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({ where: { slug: achievement.slug }, update: achievement, create: achievement });
  }
  console.log(`✅ Seeded ${achievements.length} achievements`);
}

async function seedOfficialGames(categories: { id: string; slug: string }[]) {
  const catId = (slug: string) => categories.find((c) => c.slug === slug)?.id;

  // The 15 official NexPlay titles. Each entry drives the catalog, detail
  // pages, chat context, admin panel and search — nothing is hardcoded in
  // the UI. Art lives in /public/games and is admin-replaceable later.
  const games = [
    // ── Card Games ──
    { slug: "teen-patti", title: "Teen Patti", category: "card-games", order: 1, featured: true, trending: true,
      description: "The classic three-card game loved across South Asia.",
      longDescription: "Teen Patti is a three-card game built on bluffing, reading your table and knowing when to hold your nerve. Rankings run from Trail down to High Card, and every round rewards patience as much as luck." },
    { slug: "teen-patti-20-20", title: "Teen Patti 20-20", category: "card-games", order: 2, featured: true, trending: false,
      description: "Fast-format Teen Patti played as best of three rounds.",
      longDescription: "A quicker take on the classic: three short rounds, twenty points each, and a running scoreline. Built for players who want the Teen Patti feel without a long table session." },
    { slug: "andar-bahar", title: "Andar Bahar", category: "card-games", order: 3, featured: true, trending: true,
      description: "A pure, fast-paced guessing game of two simple sides.",
      longDescription: "One card is drawn, then cards fall to the Andar or Bahar side until a match appears. Simple to learn in seconds, endlessly re-playable, and one of the most popular formats in the region." },
    { slug: "blackjack", title: "Blackjack", category: "card-games", order: 4, featured: true, trending: false,
      description: "Get as close to 21 as you can without going over.",
      longDescription: "The most widely played casino card game in the world. Hit, stand, split or double — every decision shifts the odds, which is why Blackjack rewards strategy more than almost any other table game." },
    { slug: "baccarat", title: "Baccarat", category: "card-games", order: 5, featured: false, trending: false,
      description: "An elegant Player-versus-Banker card comparison game.",
      longDescription: "Baccarat is refined and beautifully simple: back the Player, the Banker or a Tie, and the closest hand to nine wins. Long a favourite of high-limit rooms for its clean, fast rounds." },
    { slug: "poker", title: "Poker", category: "card-games", order: 6, featured: true, trending: true,
      description: "The ultimate game of skill, reading and nerve.",
      longDescription: "Poker is where card knowledge meets psychology. Position, pot odds and table image matter as much as the cards you hold — which is why it remains the most respected game in the room." },

    // ── Table Games ──
    { slug: "roulette", title: "Roulette", category: "table-games", order: 7, featured: true, trending: false,
      description: "The iconic spinning wheel of red, black and green.",
      longDescription: "Few images say casino like a roulette wheel. Inside bets, outside bets, columns and dozens give it real depth beneath a famously simple surface." },
    { slug: "dragon-tiger", title: "Dragon Tiger", category: "table-games", order: 8, featured: false, trending: true,
      description: "A two-card duel — one card each, highest wins.",
      longDescription: "Dragon Tiger strips card play to its fastest form: one card to Dragon, one to Tiger, higher card takes it. Rounds resolve in seconds, which is exactly the appeal." },
    { slug: "sic-bo", title: "Sic Bo", category: "table-games", order: 9, featured: false, trending: false,
      description: "An ancient three-dice game of Big, Small and Triples.",
      longDescription: "Sic Bo has been played for centuries. Three dice, a wide betting grid, and outcomes ranging from safe Big/Small calls to rare triples — variety is what keeps the table busy." },
    { slug: "lucky-7", title: "Lucky 7", category: "table-games", order: 10, featured: false, trending: false,
      description: "Pick your number and see where luck lands.",
      longDescription: "Lucky 7 is number-picking at its most direct: choose a number or a side, watch the draw, done. No learning curve, which makes it a natural first stop for new players." },

    // ── Crash & Instant ──
    { slug: "aviator", title: "Aviator", category: "instant-games", order: 11, featured: true, trending: true,
      description: "A rising-curve instant game — timing is everything.",
      longDescription: "Aviator built a global following on one idea: a multiplier climbs, and you decide when to step away. Every round is short, tense and entirely about nerve." },
    { slug: "crash", title: "Crash", category: "instant-games", order: 12, featured: true, trending: true,
      description: "Watch the multiplier climb and choose your moment.",
      longDescription: "Crash is the instant-game format that defined the genre — a curve that rises until it doesn't. Rounds last seconds, and the whole table watches the same graph." },
    { slug: "plinko", title: "Plinko", category: "instant-games", order: 13, featured: false, trending: true,
      description: "Drop the ball and watch it bounce to a slot.",
      longDescription: "Plinko turns a pegboard into a game: release from the top, watch physics take over, and see which slot it settles in. Instantly readable and oddly hypnotic." },

    // ── Lottery & Numbers ──
    { slug: "keno", title: "Keno", category: "number-games", order: 14, featured: false, trending: false,
      description: "Pick your numbers and match the draw.",
      longDescription: "Keno is a lottery-style number game with roots going back centuries. Choose up to ten numbers from a grid of eighty, then watch how many the draw matches." },

    // ── Slots ──
    { slug: "slot-machines", title: "Slot Machines", category: "slots", order: 15, featured: true, trending: false,
      description: "Classic reels, symbols and bonus features.",
      longDescription: "The most recognisable format in gaming. Spinning reels, wilds, scatters and bonus rounds — slots stay popular because every spin resolves instantly." },
  ];

  const idBySlug = new Map<string, string>();

  for (const g of games) {
    const data = {
      title: g.title,
      description: g.description,
      longDescription: g.longDescription,
      status: "PUBLISHED" as const,
      categoryId: catId(g.category),
      coverImageUrl: `/games/${g.slug}.jpg`,
      logoUrl: `/games/${g.slug}.jpg`,
      bannerUrl: `/games/${g.slug}.jpg`,
      displayOrder: g.order,
      isFeatured: g.featured,
      isTrending: g.trending,
    };
    const game = await prisma.game.upsert({
      where: { slug: g.slug },
      update: data,
      create: { slug: g.slug, ...data },
    });
    idBySlug.set(g.slug, game.id);
  }

  // Retire any game that is not part of the official catalog. Soft-delete
  // keeps referential history (reviews, sessions) intact rather than
  // destroying related user data.
  const officialSlugs = games.map((g) => g.slug);
  const retired = await prisma.game.updateMany({
    where: { slug: { notIn: officialSlugs }, deletedAt: null },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });
  if (retired.count) console.log(`   ↳ Retired ${retired.count} legacy game(s) not in the official catalog`);

  console.log(`✅ Seeded ${games.length} official games`);
  return idBySlug;
}

async function seedFAQs() {
  const faqs = [
    { question: "Is NexPlay free to join?", answer: "Yes. Creating a NexPlay account and browsing games, leaderboards, and tournaments is completely free.", category: "general", order: 1 },
    { question: "How do I earn rewards?", answer: "You earn NexPlay Coins by competing in ranked matches and tournaments, then redeem them in the Rewards store.", category: "general", order: 2 },
    { question: "Which platforms are supported?", answer: "NexPlay currently runs in-browser, with native desktop and console clients planned for a later phase.", category: "general", order: 3 },
    { question: "Are tournaments fair and secure?", answer: "Competitive integrity systems (anti-cheat, verified matchmaking) are part of the ongoing backend roadmap.", category: "security", order: 1 },
  ];

  for (const faq of faqs) {
    const existing = await prisma.fAQ.findFirst({ where: { question: faq.question } });
    if (existing) {
      await prisma.fAQ.update({ where: { id: existing.id }, data: faq });
    } else {
      await prisma.fAQ.create({ data: faq });
    }
  }
  console.log(`✅ Seeded ${faqs.length} FAQs`);
}



async function seedMessengerContent() {
  const quickLinks = [
    { category: "FEATURED_GAME" as const, label: "Shadow Protocol", url: "/games/shadow-protocol", iconName: "Gamepad2", order: 1 },
    { category: "TRENDING_GAME" as const, label: "Apex Throne", url: "/games/apex-throne", iconName: "TrendingUp", order: 1 },
    { category: "REWARD" as const, label: "Daily Rewards", url: "/rewards", iconName: "Gift", order: 1 },
    { category: "TOURNAMENT" as const, label: "Tournaments", url: "/tournaments", iconName: "Trophy", order: 1 },
    { category: "CASINO" as const, label: "Casino Lobby", url: "/games?category=casino", iconName: "Dices", order: 1 },
    { category: "POKER" as const, label: "Poker Tables", url: "/games?category=poker", iconName: "Spade", order: 2 },
    { category: "ROULETTE" as const, label: "Roulette", url: "/games?category=roulette", iconName: "CircleDot", order: 3 },
    { category: "BLACKJACK" as const, label: "Blackjack", url: "/games?category=blackjack", iconName: "Club", order: 4 },
    { category: "SLOTS" as const, label: "Slots", url: "/games?category=slots", iconName: "Cherry", order: 5 },
  ];

  for (const link of quickLinks) {
    // Idempotent-ish: skip if a link with the same label already exists.
    const existing = await prisma.quickLink.findFirst({ where: { label: link.label, category: link.category } });
    if (!existing) await prisma.quickLink.create({ data: link });
  }

  const announcementExists = await prisma.announcement.findFirst({ where: { title: "Welcome to NexPlay" } });
  if (!announcementExists) {
    await prisma.announcement.create({
      data: {
        title: "Welcome to NexPlay",
        body: "New games drop every week. Tap any quick link below to explore rewards, tournaments, and more.",
      },
    });
  }

  console.log(`✅ Seeded ${quickLinks.length} messenger quick links + welcome announcement`);
}

async function seedCmsContent() {
  // Legal / info pages
  const legalPages = [
    {
      slug: "about",
      title: "About NexPlay",
      body: "# About NexPlay\n\nNexPlay is a premium gaming platform where players compete in tournaments, climb global leaderboards, and earn rewards. Our mission is to make competitive gaming accessible, fair, and rewarding for everyone.",
    },
    {
      slug: "terms",
      title: "Terms of Service",
      body: "# Terms of Service\n\nBy using NexPlay, you agree to these terms. Please read them carefully.\n\n## Acceptable Use\n\nYou agree to use the platform fairly and not to cheat, exploit, or disrupt other players' experience.",
    },
    {
      slug: "privacy",
      title: "Privacy Policy",
      body: "# Privacy Policy\n\nWe respect your privacy. This policy explains what data we collect and how we use it.\n\n## Data We Collect\n\nAccount information, gameplay statistics, and support conversations to improve your experience.",
    },
  ];
  for (const page of legalPages) {
    const existing = await prisma.legalPage.findUnique({ where: { slug: page.slug } });
    if (!existing) await prisma.legalPage.create({ data: page });
  }

  // Default SEO for the main routes
  const seoEntries = [
    { path: "/", title: "NexPlay — Play • Compete • Earn", description: "Compete in tournaments, climb leaderboards, and earn rewards on NexPlay." },
    { path: "/games", title: "Games — NexPlay", description: "Browse the full catalog of games available on NexPlay." },
    { path: "/about", title: "About — NexPlay", description: "Learn about NexPlay, the premium competitive gaming platform." },
  ];
  for (const entry of seoEntries) {
    const existing = await prisma.seoMeta.findUnique({ where: { path: entry.path } });
    if (!existing) await prisma.seoMeta.create({ data: { ...entry, keywords: ["gaming", "esports", "nexplay"] } });
  }

  // Homepage hero content block
  const heroKey = "homepage.hero";
  const existingHero = await prisma.siteContent.findUnique({ where: { key: heroKey } });
  if (!existingHero) {
    await prisma.siteContent.create({
      data: {
        key: heroKey,
        value: {
          headline: "Play. Compete. Earn.",
          subtext: "Join tournaments, climb the global leaderboard, and turn your skill into rewards.",
          ctaLabel: "Get Started",
          ctaHref: "/register",
        },
      },
    });
  }

  console.log("✅ Seeded CMS content (legal pages, SEO, homepage hero)");
}

async function seedRewardsEconomy() {
  // Wheel segments — weights are server-side only; the client never sees them.
  const segments = [
    { label: "50 Coins", rewardType: "COINS" as const, coinAmount: 50, color: "#7C3AED", weight: 24, order: 1 },
    { label: "Badge", rewardType: "BADGE" as const, coinAmount: 0, color: "#06B6D4", weight: 10, order: 2 },
    { label: "100 Coins", rewardType: "COINS" as const, coinAmount: 100, color: "#F59E0B", weight: 20, order: 3 },
    { label: "Try Again", rewardType: "NOTHING" as const, coinAmount: 0, color: "#3F3F46", weight: 18, order: 4 },
    { label: "500 Coins", rewardType: "COINS" as const, coinAmount: 500, color: "#22C55E", weight: 4, order: 5 },
    { label: "Frame", rewardType: "FRAME" as const, coinAmount: 0, color: "#8B5CF6", weight: 8, order: 6 },
    { label: "200 Coins", rewardType: "COINS" as const, coinAmount: 200, color: "#0EA5E9", weight: 12, order: 7 },
    { label: "Nameplate", rewardType: "NAMEPLATE" as const, coinAmount: 0, color: "#EC4899", weight: 4, order: 8 },
  ];
  for (const seg of segments) {
    const existing = await prisma.wheelSegment.findFirst({ where: { label: seg.label } });
    if (!existing) await prisma.wheelSegment.create({ data: seg });
  }

  // Daily login ladder — admin-configurable, not hardcoded in the UI.
  const daily = [
    { dayNumber: 1, label: "50 Coins", rewardType: "COINS" as const, coinAmount: 50 },
    { dayNumber: 2, label: "75 Coins", rewardType: "COINS" as const, coinAmount: 75 },
    { dayNumber: 3, label: "Badge", rewardType: "BADGE" as const, coinAmount: 0 },
    { dayNumber: 4, label: "100 Coins", rewardType: "COINS" as const, coinAmount: 100 },
    { dayNumber: 5, label: "150 Coins", rewardType: "COINS" as const, coinAmount: 150 },
    { dayNumber: 6, label: "Frame", rewardType: "FRAME" as const, coinAmount: 0 },
    { dayNumber: 7, label: "500 Coins", rewardType: "COINS" as const, coinAmount: 500 },
  ];
  for (const d of daily) {
    await prisma.dailyRewardConfig.upsert({
      where: { dayNumber: d.dayNumber },
      update: d,
      create: d,
    });
  }

  // Store catalogue.
  const items = [
    { slug: "platinum-avatar-frame", name: "Platinum Avatar Frame", description: "Exclusive animated frame for top-tier players.", rarity: "PLATINUM" as const, price: 12000, order: 1 },
    { slug: "gold-coin-pack", name: "Gold Coin Pack", description: "A bundle of profile cosmetics for serious collectors.", rarity: "GOLD" as const, price: 4000, order: 2 },
    { slug: "silver-nameplate", name: "Silver Nameplate", description: "Stand out on leaderboards with a custom nameplate.", rarity: "SILVER" as const, price: 1500, order: 3 },
    { slug: "bronze-badge-bundle", name: "Bronze Badge Bundle", description: "3 collectible badges for your profile.", rarity: "BRONZE" as const, price: 600, order: 4 },
  ];
  for (const item of items) {
    await prisma.storeItem.upsert({
      where: { slug: item.slug },
      update: item,
      create: item,
    });
  }

  console.log(`✅ Seeded rewards economy (${segments.length} wheel segments, ${daily.length} daily tiers, ${items.length} store items)`);
}

async function seedTournaments(gameIdBySlug: Map<string, string>) {
  const now = new Date();
  const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const tournaments = [
    {
      slug: "teen-patti-weekly-cup",
      title: "Teen Patti Weekly Cup",
      gameSlug: "teen-patti",
      description: "A weekly knockout across three-card tables. Open to all skill levels.",
      rules: "Single elimination. Best of three rounds per match. Players must join the lobby within 5 minutes of their scheduled match or forfeit.",
      status: "REGISTRATION_OPEN" as const,
      maxParticipants: 256,
      prizePoolCents: 0,
      startsAt: inDays(3),
      registrationClosesAt: inDays(2),
    },
    {
      slug: "blackjack-masters",
      title: "Blackjack Masters",
      gameSlug: "blackjack",
      description: "A strategy-focused series for players who know when to hit and when to hold.",
      rules: "Round robin group stage followed by a knockout final. Standard blackjack rules; dealer stands on soft 17.",
      status: "IN_PROGRESS" as const,
      maxParticipants: 128,
      prizePoolCents: 0,
      startsAt: inDays(-1),
      endsAt: inDays(2),
    },
    {
      slug: "aviator-speed-run",
      title: "Aviator Speed Run",
      gameSlug: "aviator",
      description: "Fast rounds, tight nerves. The instant-game event of the season.",
      rules: "Fixed number of rounds per player. Highest cumulative multiplier wins. Auto-cashout is disabled for this event.",
      status: "REGISTRATION_OPEN" as const,
      maxParticipants: 512,
      prizePoolCents: 0,
      startsAt: inDays(7),
      registrationClosesAt: inDays(6),
    },
  ];

  let created = 0;
  for (const t of tournaments) {
    const gameId = gameIdBySlug.get(t.gameSlug);
    if (!gameId) continue;
    const { gameSlug, ...data } = t;
    const existing = await prisma.tournament.findUnique({ where: { slug: t.slug } });
    if (!existing) {
      await prisma.tournament.create({ data: { ...data, gameId } });
      created++;
    }
  }
  console.log(`✅ Seeded ${created} tournaments`);
}

async function seedCustomerTags() {
  // Starter tag set — admins can add, rename or deactivate these freely.
  const tags = [
    { slug: "vip", label: "VIP", color: "#F59E0B", order: 1, description: "High-value customer" },
    { slug: "new", label: "New", color: "#06B6D4", order: 2, description: "Recently joined" },
    { slug: "paid", label: "Paid", color: "#22C55E", order: 3, description: "Has completed a deposit" },
    { slug: "unpaid", label: "Unpaid", color: "#71717A", order: 4, description: "No deposit recorded" },
    { slug: "high-priority", label: "High Priority", color: "#EF4444", order: 5, description: "Needs fast response" },
    { slug: "watchlist", label: "Watchlist", color: "#8B5CF6", order: 6, description: "Flagged for review" },
  ];
  for (const tag of tags) {
    await prisma.customerTag.upsert({ where: { slug: tag.slug }, update: tag, create: tag });
  }
  console.log(`✅ Seeded ${tags.length} customer tags`);
}

async function seedDemoLoginHistory() {
  // Only seeded when the table is empty, so this never pollutes a system
  // that already has real sign-in data.
  const existing = await prisma.loginHistory.count();
  if (existing > 0) {
    console.log("↷ Skipped demo login history (real data present)");
    return;
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true },
    take: 3,
    orderBy: { createdAt: "asc" },
  });
  if (users.length < 2) {
    console.log("↷ Skipped demo login history (needs at least 2 accounts)");
    return;
  }

  // Two accounts sharing an address and a device — exactly the pattern
  // the related-accounts check is meant to surface for an agent to judge.
  const sharedIp = "203.0.113.42";
  const sharedDevice = "Chrome on Windows";

  const rows = [
    { userId: users[0].id, ipAddress: sharedIp, device: sharedDevice },
    { userId: users[0].id, ipAddress: "203.0.113.77", device: sharedDevice },
    { userId: users[1].id, ipAddress: sharedIp, device: sharedDevice },
    { userId: users[1].id, ipAddress: "198.51.100.9", device: "Safari on iOS" },
  ];
  if (users[2]) rows.push({ userId: users[2].id, ipAddress: "198.51.100.55", device: "Firefox on Linux" });

  await prisma.loginHistory.createMany({
    data: rows.map((r) => ({ ...r, success: true })),
  });

  console.log(`✅ Seeded ${rows.length} demo sign-in records (two accounts overlap on purpose)`);
}

async function main() {
  console.log("🌱 Seeding NexPlay database...\n");

  await seedAdmin();
  const categories = await seedGameCategories();
  await seedBadges();
  await seedAchievements();
  const gameIds = await seedOfficialGames(categories);
  await seedRewardsEconomy();
  await seedTournaments(gameIds);
  await seedFAQs();
  await seedMessengerContent();
  await seedCmsContent();
  await seedCustomerTags();
  await seedDemoLoginHistory();

  console.log("\n✅ Seed complete.");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
