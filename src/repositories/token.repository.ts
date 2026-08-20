import { prisma } from "@/config/db";

export const tokenRepository = {
  // ── Sessions ──────────────────────────────────────
  createSession(data: { userId: string; userAgent?: string; ipAddress?: string; expiresAt: Date }) {
    return prisma.session.create({ data });
  },

  revokeSession(sessionId: string) {
    return prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } });
  },

  findSession(sessionId: string) {
    return prisma.session.findUnique({ where: { id: sessionId } });
  },

  // ── Refresh tokens (rotated on every use) ────────
  createRefreshToken(data: { userId: string; sessionId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  },

  findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  rotateRefreshToken(oldTokenHash: string, newTokenHash: string) {
    return prisma.refreshToken.update({
      where: { tokenHash: oldTokenHash },
      data: { isRevoked: true, replacedBy: newTokenHash },
    });
  },

  revokeRefreshToken(tokenHash: string) {
    return prisma.refreshToken.update({ where: { tokenHash }, data: { isRevoked: true } });
  },

  revokeAllForUser(userId: string) {
    return prisma.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
  },

  // ── Email verification tokens ────────────────────
  createEmailVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.emailVerificationToken.create({ data });
  },

  findEmailVerificationToken(tokenHash: string) {
    return prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  },

  markEmailVerificationTokenUsed(id: string) {
    return prisma.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } });
  },

  // ── Password reset tokens ────────────────────────
  createPasswordResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.passwordResetToken.create({ data });
  },

  findPasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  },

  markPasswordResetTokenUsed(id: string) {
    return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  },
};
