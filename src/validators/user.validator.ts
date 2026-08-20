import { z } from "zod";

export const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().trim().max(40).optional(),
    bio: z.string().trim().max(280).optional(),
    country: z.string().trim().max(56).optional(),
    language: z.string().trim().max(10).optional(),
    timezone: z.string().trim().max(64).optional(),
    favoriteGenres: z.array(z.string().trim().max(30)).max(10).optional(),
    favoriteGames: z.array(z.string().trim().max(60)).max(10).optional(),
  }),
});

export const updateSettingsSchema = z.object({
  body: z.object({
    profileVisibility: z.enum(["PUBLIC", "FRIENDS_ONLY", "PRIVATE"]).optional(),
    showOnlineStatus: z.boolean().optional(),
    showGameActivity: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>["body"];
