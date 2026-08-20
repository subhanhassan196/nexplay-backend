export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const CACHE_TTL_SECONDS = {
  SHORT: 60, // 1 minute — fast-changing data (future: live leaderboard snippets)
  MEDIUM: 60 * 15, // 15 minutes — semi-stable lists (future: categories, games catalog)
  LONG: 60 * 60 * 24, // 24 hours — rarely-changing reference data
} as const;

export const UPLOAD_LIMITS = {
  AVATAR_MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  BANNER_MAX_SIZE_BYTES: 8 * 1024 * 1024, // 8MB
  ALLOWED_IMAGE_MIME_TYPES: ["image/jpeg", "image/png", "image/webp"] as string[],
} as const;
