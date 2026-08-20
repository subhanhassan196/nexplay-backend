import { getSocketServer } from "@/config/socket";
import { SOCKET_EVENTS, ROOMS } from "@/constants/socketEvents";

/**
 * Thin wrapper the REST/service layer uses to broadcast real-time
 * events after a successful DB write. Kept separate from socket.ts's
 * connection handling so business logic never imports the raw io
 * instance — it calls these named intents instead. All methods no-op
 * safely if the socket server isn't up (e.g. during tests).
 */
export const realtimeEmitter = {
  /**
   * Support availability changed. Broadcast to every connected client —
   * the "Online / Offline" indicator in the messenger has to reflect the
   * admin toggle immediately, not on next page load.
   */
  supportSettingsChanged(settings: { isOnline: boolean; supportHours?: string; offlineMessage?: string }) {
    const io = getSocketServer();
    if (!io) return;
    io.emit(SOCKET_EVENTS.SUPPORT_SETTINGS, settings);
  },

  /** A brand-new message was persisted — push to everyone in the conversation room + the agents queue. */
  messageCreated(conversationId: string, message: unknown, notifyAgents = true) {
    const io = getSocketServer();
    if (!io) return;
    io.to(ROOMS.conversation(conversationId)).emit(SOCKET_EVENTS.MESSAGE_NEW, { conversationId, message });
    if (notifyAgents) io.to(ROOMS.agents).emit(SOCKET_EVENTS.MESSAGE_NEW, { conversationId, message });
  },

  /** A message was edited / deleted / reacted to. */
  messageUpdated(conversationId: string, message: unknown) {
    const io = getSocketServer();
    if (!io) return;
    io.to(ROOMS.conversation(conversationId)).emit(SOCKET_EVENTS.MESSAGE_UPDATED, { conversationId, message });
  },

  /** Conversation state / assignment / priority / tags changed — refresh inboxes. */
  conversationUpdated(conversation: { id: string; userId: string }) {
    const io = getSocketServer();
    if (!io) return;
    io.to(ROOMS.conversation(conversation.id)).emit(SOCKET_EVENTS.CONVERSATION_UPDATED, { conversation });
    io.to(ROOMS.user(conversation.userId)).emit(SOCKET_EVENTS.CONVERSATION_UPDATED, { conversation });
    io.to(ROOMS.agents).emit(SOCKET_EVENTS.CONVERSATION_UPDATED, { conversation });
  },

  /** Targeted push to one user (reserved for Batch 2 notifications). */
  toUser(userId: string, event: string, payload: unknown) {
    const io = getSocketServer();
    if (!io) return;
    io.to(ROOMS.user(userId)).emit(event, payload);
  },
};
