import { z } from "zod";

/**
 * Strong password policy: min 8 chars, at least one uppercase, one
 * lowercase, one number, one special character. Mirrored on the
 * frontend (src/lib/validators/auth.ts) for the strength meter — keep
 * both in sync if this policy changes.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters") // bcrypt's effective limit
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

export const registerSchema = z.object({
  body: z.object({
    username: usernameSchema,
    email: z.string().email("Enter a valid email address"),
    password: passwordSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional().default(false),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Enter a valid email address"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordSchema,
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Verification token is required"),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email("Enter a valid email address"),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
