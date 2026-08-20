import type { Request, Response } from "express";
import { authService } from "@/services/auth.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { ApiError } from "@/utils/ApiError";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/utils/cookies";
import { userRepository } from "@/repositories/user.repository";
import { toUserDTO } from "@/dtos/user.dto";

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.register(req.body);
    return ApiResponse.success(res, 201, "Account created. Check your email to verify your account.", { user });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.login(req.body, res, {
      userAgent: req.get("user-agent") ?? undefined,
      ipAddress: req.ip,
    });
    return ApiResponse.success(res, 200, "Logged in successfully.", { user });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    await authService.logout(res, req.user?.sessionId, refreshToken);
    return ApiResponse.success(res, 200, "Logged out successfully.");
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) throw ApiError.unauthorized("No active session found.");
    const user = await authService.refresh(res, refreshToken);
    return ApiResponse.success(res, 200, "Session refreshed.", { user });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized("Not authenticated.");
    const user = await userRepository.findById(req.user.id);
    if (!user) throw ApiError.notFound("User not found.");
    return ApiResponse.success(res, 200, "Current user.", { user: toUserDTO(user), profile: user.profile });
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    await authService.verifyEmail(req.body.token);
    return ApiResponse.success(res, 200, "Email verified successfully.");
  }),

  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    await authService.resendVerification(req.body.email);
    return ApiResponse.success(res, 200, "If that email exists, a new verification link has been sent.");
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body);
    return ApiResponse.success(res, 200, "If that email exists, a password reset link has been sent.");
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    return ApiResponse.success(res, 200, "Password reset successfully. You can now log in.");
  }),

  checkAccessCookiePresent: asyncHandler(async (req: Request, res: Response) => {
    return ApiResponse.success(res, 200, "ok", { authenticated: Boolean(req.cookies?.[ACCESS_TOKEN_COOKIE]) });
  }),
};
