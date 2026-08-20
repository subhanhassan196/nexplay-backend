import type { User } from "@prisma/client";

/**
 * Never send the full Prisma User row to the client — it contains
 * `passwordHash` and internal lockout counters. Always pass through
 * this DTO first.
 */
export function toUserDTO(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };
}

export type UserDTO = ReturnType<typeof toUserDTO>;
