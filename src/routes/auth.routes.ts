import { Router } from "express";
import { authController } from "@/controllers/auth.controller";
import { validate } from "@/middlewares/validate.middleware";
import { requireAuth } from "@/middlewares/auth.middleware";
import { authRateLimiter } from "@/middlewares/rateLimiter.middleware";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "@/validators/auth.validator";

const router = Router();

// ── Public ────────────────────────────────────────
router.post("/register", authRateLimiter, validate(registerSchema), authController.register);
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.post("/verify-email", validate(verifyEmailSchema), authController.verifyEmail);
router.post(
  "/resend-verification",
  authRateLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification
);
router.post(
  "/forgot-password",
  authRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.get("/status", authController.checkAccessCookiePresent);

// ── Protected ─────────────────────────────────────
router.post("/logout", requireAuth, authController.logout);
router.get("/me", requireAuth, authController.me);

// ── OAuth (architecture ready — see oauth.routes.ts) ──

export { router as authRoutes };
