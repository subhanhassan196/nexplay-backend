import { profileRepository, userSettingsRepository } from "@/repositories/profile.repository";
import { uploadService } from "@/services/upload.service";
import { NotFoundError } from "@/errors";
import { sanitizeText } from "@/helpers/sanitize";
import type { UpdateProfileInput, UpdateSettingsInput } from "@/validators/user.validator";

export const userService = {
  async getProfile(userId: string) {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError("Profile");
    return profile;
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const sanitized = {
      ...input,
      displayName: input.displayName ? sanitizeText(input.displayName, 40) : undefined,
      bio: input.bio ? sanitizeText(input.bio, 280) : undefined,
    };
    return profileRepository.update(userId, sanitized);
  },

  async getSettings(userId: string) {
    const settings = await userSettingsRepository.findByUserId(userId);
    if (!settings) throw new NotFoundError("Settings");
    return settings;
  },

  async updateSettings(userId: string, input: UpdateSettingsInput) {
    return userSettingsRepository.update(userId, input);
  },

  async uploadAvatar(userId: string, buffer: Buffer) {
    const url = await uploadService.uploadImage(buffer, "avatars", userId);
    return profileRepository.updateAvatar(userId, url);
  },

  async uploadBanner(userId: string, buffer: Buffer) {
    const url = await uploadService.uploadImage(buffer, "banners", userId);
    return profileRepository.updateBanner(userId, url);
  },
};
