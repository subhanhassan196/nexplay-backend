import type { Response } from "express";
import type { UserDTO } from "@/dtos/user.dto";

/**
 * Contract for the auth service. The concrete `authService`
 * (services/auth.service.ts) satisfies this shape; declaring it
 * separately lets future test suites mock authentication behind this
 * interface instead of the concrete implementation.
 */
export interface IAuthService {
  register(input: unknown): Promise<UserDTO>;
  verifyEmail(rawToken: string): Promise<void>;
  forgotPassword(input: unknown): Promise<void>;
  resetPassword(input: unknown): Promise<void>;
  logout(res: Response, sessionId?: string, refreshTokenRaw?: string): Promise<void>;
}
