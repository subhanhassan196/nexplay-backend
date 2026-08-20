import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError";
import { verifyAccessToken } from "@/utils/jwt";
import { ACCESS_TOKEN_COOKIE } from "@/utils/cookies";
import type { Role } from "@prisma/client";
import { permissionService } from "@/services/permission.service";
import type { Permission } from "@/constants/permissions";

/**
 * Protects a route — requires a valid, unexpired access token cookie.
 * Attaches `{ id, role, sessionId }` to `req.user` for downstream use.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token) {
    return next(ApiError.unauthorized("Authentication required"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, sessionId: payload.sessionId };
    next();
  } catch {
    return next(ApiError.unauthorized("Session expired or invalid. Please log in again."));
  }
}

/**
 * Optional-auth — attaches `req.user` if a valid token is present, but
 * does not reject the request when it's absent. Useful for endpoints
 * that behave differently for guests vs. logged-in users.
 */
export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, sessionId: payload.sessionId };
  } catch {
    // Invalid/expired token on an optional-auth route — treat as guest.
  }
  next();
}

/**
 * Role-based access control. Prepared for Phase 4+ (Moderator/Admin
 * tooling) — no admin routes are implemented in Phase 3, but the
 * primitive is ready to guard them.
 */
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized("Authentication required"));
    if (!allowed.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}

/**
 * Capability-based guard. Prefer this over `requireRole` for admin
 * routes: it checks what the user can actually do, which means a Super
 * Admin can grant or revoke a single capability without inventing a new
 * role — and a Support Agent calling a protected endpoint by hand is
 * rejected at the API layer, not just hidden in the UI.
 */
export function requirePermission(permission: Permission) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized("Authentication required"));

    const allowed = await permissionService.has(req.user.id, req.user.role, permission);
    if (!allowed) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}
