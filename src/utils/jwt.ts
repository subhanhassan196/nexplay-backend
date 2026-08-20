import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/config/env";
import type { Role } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string; // userId
  role: Role;
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  sessionId: string;
  tokenId: string; // matches RefreshToken.id in DB, enables rotation/revocation
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload, expiresIn: string): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
