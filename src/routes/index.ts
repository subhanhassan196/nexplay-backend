import { Router } from "express";
import { authRoutes } from "@/routes/auth.routes";
import { oauthRoutes } from "@/routes/oauth.routes";
import { userRoutes } from "@/routes/user.routes";
import { gamesRoutes } from "@/routes/games.routes";
import { categoriesRoutes } from "@/routes/categories.routes";
import { leaderboardRoutes } from "@/routes/leaderboard.routes";
import { rewardsRoutes } from "@/routes/rewards.routes";
import { notificationsRoutes } from "@/routes/notifications.routes";
import { communityRoutes, adminCommunityRoutes } from "@/routes/community.routes";
import { messengerRoutes } from "@/routes/messenger.routes";
import { adminSupportRoutes } from "@/routes/adminSupport.routes";
import { notificationRoutes } from "@/routes/notification.routes";
import { activityRoutes } from "@/routes/activity.routes";
import { searchRoutes } from "@/routes/search.routes";
import { reportingRoutes } from "@/routes/reporting.routes";
import { cmsRoutes } from "@/routes/cms.routes";
import { seoRoutes } from "@/routes/seo.routes";
import { mediaRoutes } from "@/routes/media.routes";
import { healthRoutes } from "@/routes/health.routes";
import { adminGameRoutes } from "@/routes/adminGame.routes";
import { tournamentRoutes, adminTournamentRoutes } from "@/routes/tournament.routes";
import { adminPlatformRoutes } from "@/routes/adminPlatform.routes";
import { supportWorkspaceRoutes } from "@/routes/supportWorkspace.routes";

const router = Router();

// ── Fully implemented (Phase 3-4) ────────────────
router.use("/auth", authRoutes);
router.use("/auth", oauthRoutes); // /auth/google, /auth/discord
router.use("/users", userRoutes);

// ── Global Support Messenger (Mega Phase) ────────
router.use("/messenger", messengerRoutes); // user-facing chat
router.use("/admin/support", adminSupportRoutes); // agent/admin console
router.use("/notifications", notificationRoutes); // live notification center
router.use("/admin/activity", activityRoutes); // admin activity center
router.use("/admin/search", searchRoutes); // global admin search
router.use("/admin/reports", reportingRoutes); // support analytics
router.use("/cms", cmsRoutes); // content management (public reads + admin writes)
router.use("/seo", seoRoutes); // SEO metadata + sitemap
router.use("/admin/media", mediaRoutes); // media library
router.use("/admin/catalog", adminGameRoutes); // game + category management
router.use("/tournaments", tournamentRoutes); // public tournament listing + detail
router.use("/admin/tournaments", adminTournamentRoutes); // tournament management
router.use("/admin/workspace", supportWorkspaceRoutes); // agent notes, tags, financials, audit
router.use("/admin/platform", adminPlatformRoutes); // users, roles, permissions, rewards config, control center

// ── Reserved architecture — 501 until their phase ships ──
router.use("/games", gamesRoutes); // Phase 6
router.use("/categories", categoriesRoutes); // Phase 6
router.use("/leaderboard", leaderboardRoutes); // Phase 8/9
router.use("/rewards", rewardsRoutes); // Phase 8
router.use("/notifications", notificationsRoutes); // Phase 10
router.use("/community", communityRoutes);
router.use("/admin/community", adminCommunityRoutes); // post/comment moderation // Phase 7

router.use("/health", healthRoutes); // liveness + detailed subsystem checks

export { router as apiRouter };
