import type { Response } from "express";
import { env } from "@/config/env";
import { userRepository } from "@/repositories/user.repository";
import { tokenRepository } from "@/repositories/token.repository";
import { tokenService } from "@/services/token.service";
import { emailService } from "@/services/email.service";
import { hashPassword, comparePassword } from "@/utils/hash";
import { generateSecureToken, hashToken } from "@/utils/secureToken";
import { ApiError } from "@/utils/ApiError";
import { toUserDTO } from "@/dtos/user.dto";
import { REFRESH_TOKEN_COOKIE } from "@/utils/cookies";
import type { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from "@/validators/auth.validator";

const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_EXPIRY_MS = 30 * 60 * 1000; // 30m

export const authService = {
  // ── Register ──────────────────────────────────────
  async register(input: RegisterInput) {
    const existing = await userRepository.findByEmailOrUsername(input.email, input.username);
    if (existing) {
      if (existing.email === input.email.toLowerCase()) {
        throw ApiError.conflict("An account with this email already exists.");
      }
      throw ApiError.conflict("This username is already taken.");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.create({
      email: input.email.toLowerCase(),
      username: input.username,
      passwordHash,
      profile: { create: {} },
      settings: { create: {} },
    });

    await this.sendVerificationEmail(user.id, user.email, user.username);

    return toUserDTO(user);
  },

  async sendVerificationEmail(userId: string, email: string, username: string) {
    const { raw, hash } = generateSecureToken();
    await tokenRepository.createEmailVerificationToken({
      userId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS),
    });

    const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${raw}`;
    await emailService.sendVerificationEmail(email, username, verifyUrl).catch((err) => {
      console.error("Failed to send verification email:", err);
    });
  },

  async verifyEmail(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const record = await tokenRepository.findEmailVerificationToken(tokenHash);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest("This verification link is invalid or has expired.");
    }

    await userRepository.markEmailVerified(record.userId);
    await tokenRepository.markEmailVerificationTokenUsed(record.id);
  },

  async resendVerification(email: string) {
    const user = await userRepository.findByEmail(email);
    // Deliberately do not reveal whether the email exists.
    if (!user || user.isEmailVerified) return;
    await this.sendVerificationEmail(user.id, user.email, user.username);
  },

  // ── Login ─────────────────────────────────────────
  async login(
    input: LoginInput,
    res: Response,
    meta: { userAgent?: string; ipAddress?: string }
  ) {
    const user = await userRepository.findByEmail(input.email);

    if (!user || !user.passwordHash) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ApiError(
        423,
        `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
      );
    }

    const passwordValid = await comparePassword(input.password, user.passwordHash);

    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;

      if (attempts >= env.MAX_FAILED_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + env.ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000);
        await userRepository.lockAccount(user.id, lockedUntil);
        await userRepository.incrementFailedAttempts(user.id);

        const resetUrl = `${env.CLIENT_URL}/forgot-password`;
        await emailService.sendAccountLockedEmail(user.email, user.username, resetUrl).catch(() => undefined);

        throw new ApiError(
          423,
          `Too many failed attempts. Your account has been locked for ${env.ACCOUNT_LOCK_DURATION_MINUTES} minutes.`
        );
      }

      await userRepository.incrementFailedAttempts(user.id);
      throw ApiError.unauthorized("Invalid email or password.");
    }

    // Successful login — reset lockout counters.
    await userRepository.resetFailedAttempts(user.id);

    await tokenService.issueSession({
      res,
      userId: user.id,
      role: user.role,
      rememberMe: input.rememberMe,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    return toUserDTO(user);
  },

  // ── Logout ────────────────────────────────────────
  async logout(res: Response, sessionId?: string, refreshTokenRaw?: string) {
    if (sessionId) await tokenService.revokeSession(sessionId);
    if (refreshTokenRaw) {
      await tokenRepository.revokeRefreshToken(hashToken(refreshTokenRaw)).catch(() => undefined);
    }
    tokenService.clearCookies(res);
  },

  // ── Refresh ───────────────────────────────────────
  async refresh(res: Response, refreshTokenRaw: string) {
    const { payload, stored } = await tokenService.rotate({ res, refreshToken: refreshTokenRaw });

    const user = await userRepository.findById(payload.sub);
    if (!user) {
      tokenService.clearCookies(res);
      throw ApiError.unauthorized("Account no longer exists.");
    }

    const session = await tokenRepository.findSession(payload.sessionId);
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      tokenService.clearCookies(res);
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }

    // Heuristic: sessions created with "remember me" have a materially
    // longer lifetime than the standard 7-day window.
    const totalLifetimeMs = session.expiresAt.getTime() - session.createdAt.getTime();
    const rememberMe = totalLifetimeMs > 8 * 24 * 60 * 60 * 1000;

    await tokenService.finalizeRotation({
      res,
      oldTokenHash: hashToken(refreshTokenRaw),
      userId: user.id,
      role: user.role,
      sessionId: session.id,
      rememberMe,
    });

    return toUserDTO(user);
  },

  // ── Forgot / Reset Password ──────────────────────
  async forgotPassword(input: ForgotPasswordInput) {
    const user = await userRepository.findByEmail(input.email);
    // Deliberately do not reveal whether the email exists — always respond success upstream.
    if (!user) return;

    const { raw, hash } = generateSecureToken();
    await tokenRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
    });

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${raw}`;
    await emailService.sendPasswordResetEmail(user.email, user.username, resetUrl).catch((err) => {
      console.error("Failed to send password reset email:", err);
    });
  },

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = hashToken(input.token);
    const record = await tokenRepository.findPasswordResetToken(tokenHash);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest("This reset link is invalid or has expired.");
    }

    const passwordHash = await hashPassword(input.password);
    await userRepository.updatePassword(record.userId, passwordHash);
    await tokenRepository.markPasswordResetTokenUsed(record.id);

    // Invalidate every existing session — a password reset should log
    // out all devices, including whoever might have compromised the account.
    await tokenRepository.revokeAllForUser(record.userId);
  },

  cookieName: REFRESH_TOKEN_COOKIE,
};
