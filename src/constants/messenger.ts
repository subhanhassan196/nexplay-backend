/**
 * Keys for the SupportSetting key-value table + their built-in
 * fallbacks. The service layer returns these defaults when an admin
 * hasn't overridden them yet, so the messenger is never blank on a
 * fresh install — but every one of them is admin-editable (nothing
 * here is hardcoded into UI components).
 */
export const SUPPORT_SETTING_KEYS = {
  WELCOME_MESSAGE: "welcome_message",
  SUPPORT_HOURS: "support_hours",
  IS_ONLINE: "is_online",
  OFFLINE_MESSAGE: "offline_message",
} as const;

export const SUPPORT_SETTING_DEFAULTS: Record<string, string> = {
  [SUPPORT_SETTING_KEYS.WELCOME_MESSAGE]:
    "Welcome to NexPlay Support! 👋 Ask us anything about games, rewards, tournaments, or your account.",
  [SUPPORT_SETTING_KEYS.SUPPORT_HOURS]: "24/7",
  [SUPPORT_SETTING_KEYS.IS_ONLINE]: "true",
  [SUPPORT_SETTING_KEYS.OFFLINE_MESSAGE]:
    "Our team is currently offline. Leave a message and we'll get back to you as soon as we're back.",
};
