import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { NotImplementedError } from "@/errors";
import { attachUserIfPresent } from "@/middlewares/auth.middleware";

/**
 * Generates a fully-wired router (with the same middleware pipeline
 * every real module uses) for a domain that Phase 4 intentionally does
 * NOT implement yet — Games, Categories, Leaderboard, Rewards,
 * Notifications, Community.
 *
 * WHY THIS EXISTS: the Phase 4 brief explicitly reserves these domains
 * for later phases (6-10) while asking for "architecture that future
 * phases can extend." Rather than omit the routes entirely (which
 * would make the frontend's placeholder pages 404) or fake real logic
 * (which the brief explicitly forbids), each of these returns a clear,
 * consistent `501 Not Implemented` — a real, honest API contract that
 * a later phase upgrades in place by replacing the handler body with
 * real service/repository calls. The route path, method, and response
 * envelope shape won't need to change when that happens.
 */
export function createPlaceholderModule(moduleName: string, routes: { method: "get" | "post"; path: string }[]) {
  const router = Router();

  router.use(attachUserIfPresent);

  for (const { method, path } of routes) {
    router[method](
      path,
      asyncHandler(async () => {
        throw new NotImplementedError(moduleName);
      })
    );
  }

  return router;
}
