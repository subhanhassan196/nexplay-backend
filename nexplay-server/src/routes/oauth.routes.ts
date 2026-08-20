import { Router } from "express";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { asyncHandler } from "@/utils/asyncHandler";

/**
 * OAuth routes — ARCHITECTURE PREPARED, NOT ACTIVATED.
 *
 * Full OAuth (Google, Discord) requires real client IDs/secrets which
 * are intentionally not part of this phase's deliverable. The routes,
 * env vars (.env.example), and OAuthAccount Prisma model are already
 * in place so wiring this up later is a matter of:
 *
 *   1. Add a proper OAuth strategy (e.g. `openid-client` or `arctic`)
 *   2. Implement `/google` (redirect to consent screen) and
 *      `/google/callback` (exchange code -> tokens -> find-or-create
 *      User + OAuthAccount -> tokenService.issueSession)
 *   3. Mirror the same for `/discord`
 *
 * Until then, these endpoints return a clear 501 rather than silently
 * failing or pretending to work.
 */
const router = Router();

router.get(
  "/google",
  asyncHandler(async (_req, _res) => {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new ApiError(501, "Google OAuth is not configured yet.");
    }
    throw new ApiError(501, "Google OAuth flow not yet implemented — architecture ready.");
  })
);

router.get(
  "/google/callback",
  asyncHandler(async (_req, _res) => {
    throw new ApiError(501, "Google OAuth flow not yet implemented — architecture ready.");
  })
);

router.get(
  "/discord",
  asyncHandler(async (_req, _res) => {
    if (!env.DISCORD_CLIENT_ID) {
      throw new ApiError(501, "Discord OAuth is not configured yet.");
    }
    throw new ApiError(501, "Discord OAuth flow not yet implemented — architecture ready.");
  })
);

router.get(
  "/discord/callback",
  asyncHandler(async (_req, _res) => {
    throw new ApiError(501, "Discord OAuth flow not yet implemented — architecture ready.");
  })
);

export { router as oauthRoutes };
