import crypto from "crypto";
import type { Response } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "@/config/db";
import { env } from "@/config/env";
import { tokenRepository } from "@/repositories/token.repository";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/utils/jwt";
import { hashToken } from "@/utils/secureToken";
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from "@/utils/cookies";
import { ApiError } from "@/utils/ApiError";

function msFromExpiry(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, num, unit] = match;
  const n = Number(num);
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * multipliers[unit];
}

export const tokenService = {
  /**
   * Issues a fresh access + refresh token pair for a brand-new session
   * (used on register/login), persists the session + refresh token
   * hash, and sets both as httpOnly cookies on the response.
   */
  async issueSession(params: {
    res: Response;
    userId: string;
    role: Role;
    rememberMe: boolean;
    userAgent?: string;
    ipAddress?: string;
  }) {
    const { res, userId, role, rememberMe, userAgent, ipAddress } = params;

    const refreshExpiresIn = rememberMe
      ? env.JWT_REFRESH_EXPIRES_IN_REMEMBER_ME
      : env.JWT_REFRESH_EXPIRES_IN;
    const sessionExpiresAt = new Date(Date.now() + msFromExpiry(refreshExpiresIn));

    const session = await tokenRepository.createSession({
      userId,
      userAgent,
      ipAddress,
      expiresAt: sessionExpiresAt,
    });

    const { accessToken, refreshToken } = await this.mintTokenPair({
      userId,
      role,
      sessionId: session.id,
      refreshExpiresIn,
    });

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken, rememberMe);

    return { session, accessToken, refreshToken };
  },

  /**
   * Signs a new access+refresh pair and persists the refresh token hash.
   * The refresh token's `tokenId` claim is generated up front (not the
   * DB auto-id) so we can embed it in the JWT before the row exists,
   * then create the row with that same id — no placeholder juggling.
   */
  async mintTokenPair(params: { userId: string; role: Role; sessionId: string; refreshExpiresIn: string }) {
    const { userId, role, sessionId, refreshExpiresIn } = params;

    const tokenId = crypto.randomUUID();
    const accessToken = signAccessToken({ sub: userId, role, sessionId });
    const refreshToken = signRefreshToken({ sub: userId, sessionId, tokenId }, refreshExpiresIn);

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        sessionId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + msFromExpiry(refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken, refreshTokenId: tokenId };
  },

  /**
   * Refresh-token rotation flow: verifies the incoming refresh token,
   * detects reuse of an already-rotated (revoked) token — a strong
   * signal of token theft — and issues a brand-new pair while revoking
   * the old one.
   */
  async rotate(params: { res: Response; refreshToken: string }) {
    const { res, refreshToken } = params;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      clearAuthCookies(res);
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await tokenRepository.findRefreshTokenByHash(tokenHash);

    if (!stored) {
      clearAuthCookies(res);
      throw ApiError.unauthorized("Session not recognized. Please log in again.");
    }

    if (stored.isRevoked) {
      // Reuse of a rotated/revoked token — possible theft. Nuke the whole session tree.
      await tokenRepository.revokeAllForUser(stored.userId);
      clearAuthCookies(res);
      throw ApiError.unauthorized("Security alert: session invalidated. Please log in again.");
    }

    if (stored.expiresAt < new Date()) {
      clearAuthCookies(res);
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }

    return { payload, stored };
  },

  async finalizeRotation(params: {
    res: Response;
    oldTokenHash: string;
    userId: string;
    role: Role;
    sessionId: string;
    rememberMe: boolean;
  }) {
    const { res, oldTokenHash, userId, role, sessionId, rememberMe } = params;
    const refreshExpiresIn = rememberMe
      ? env.JWT_REFRESH_EXPIRES_IN_REMEMBER_ME
      : env.JWT_REFRESH_EXPIRES_IN;

    const { accessToken, refreshToken } = await this.mintTokenPair({
      userId,
      role,
      sessionId,
      refreshExpiresIn,
    });

    await tokenRepository.rotateRefreshToken(oldTokenHash, hashToken(refreshToken));

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken, rememberMe);

    return { accessToken, refreshToken };
  },

  async revokeSession(sessionId: string) {
    await tokenRepository.revokeSession(sessionId);
  },

  clearCookies(res: Response) {
    clearAuthCookies(res);
  },
};
