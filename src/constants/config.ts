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

  // ── Chat attachments ──
  CHAT_IMAGE_MAX_SIZE_BYTES: 8 * 1024 * 1024, // 8MB
  CHAT_DOCUMENT_MAX_SIZE_BYTES: 15 * 1024 * 1024, // 15MB
  CHAT_VOICE_MAX_SIZE_BYTES: 10 * 1024 * 1024, // ~10 min of compressed audio

  /// Deliberately a narrow allow-list. Anything not named here is
  /// rejected — an allow-list is the only safe approach for uploads,
  /// since a deny-list can always be worked around with a new extension.
  ALLOWED_DOCUMENT_MIME_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ] as string[],

  /// Browsers disagree on what they label a recording, so several
  /// equivalent types are accepted.
  ALLOWED_VOICE_MIME_TYPES: [
    "audio/webm",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-m4a",
  ] as string[],

  VOICE_MAX_DURATION_SECONDS: 300, // 5 minutes
} as const;
