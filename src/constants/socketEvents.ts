/**
 * Canonical socket event names. Both the server emitters and the client
 * listeners import from here so a typo can't silently break real-time
 * delivery (the event just wouldn't fire). Grouped by direction.
 */
export const SOCKET_EVENTS = {
  // ── Client → Server ──
  JOIN_CONVERSATION: "conversation:join",
  LEAVE_CONVERSATION: "conversation:leave",
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  MESSAGE_DELIVERED: "message:delivered", // client ack that it received a message
  MESSAGE_READ: "message:read",

  // ── Server → Client ──
  MESSAGE_NEW: "message:new",
  MESSAGE_UPDATED: "message:updated", // edit / delete / reaction
  MESSAGE_STATUS: "message:status", // delivered / read receipts
  TYPING: "typing", // someone is typing in a conversation
  PRESENCE: "presence", // online/offline change
  CONVERSATION_UPDATED: "conversation:updated", // state / assignment / priority change
  NOTIFICATION_NEW: "notification:new", // reserved for Batch 2
  SUPPORT_SETTINGS: "support:settings", // online/offline + hours changed
} as const;

/** Room helpers — everyone viewing one conversation shares a room. */
export const ROOMS = {
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  user: (userId: string) => `user:${userId}`,
  // All staff share one room so agents see new tickets/queue changes live.
  agents: "agents",
} as const;
