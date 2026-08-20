import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "@/config/env";
import { verifyAccessToken } from "@/utils/jwt";
import { SOCKET_EVENTS, ROOMS } from "@/constants/socketEvents";
import { prisma } from "@/config/db";

/**
 * Socket.IO real-time layer for the support messenger.
 *
 * Auth: reuses the same JWT access tokens as the REST API (handshake
 * verifies the token, attaches userId + role to socket.data).
 *
 * Rooms:
 *  - Every socket joins its own `user:<id>` room (targeted delivery).
 *  - Staff sockets also join the shared `agents` room (live queue).
 *  - Opening a conversation joins `conversation:<id>` so both the user
 *    and any viewing agent get messages/typing/receipts instantly.
 *
 * Presence: an in-memory ref-count per user (a user may have multiple
 * tabs/devices). First connection => online; last disconnect => offline.
 * In-memory is correct for a single-node dev/small deployment; scaling
 * to multiple nodes later would move this to Redis (the adapter is
 * already a dependency) — noted, not needed yet.
 */
let io: SocketIOServer | null = null;

// userId -> number of active sockets
const presence = new Map<string, number>();

const STAFF_ROLES = new Set(["MODERATOR", "ADMIN", "SUPER_ADMIN"]);

function isOnline(userId: string) {
  return (presence.get(userId) ?? 0) > 0;
}

export function initSocketServer(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      // Token can arrive two ways: explicit handshake auth (if the client
      // has it) or — since this app uses httpOnly cookie auth — the
      // `nexplay_access_token` cookie sent with the socket handshake.
      let token = socket.handshake.auth?.accessToken as string | undefined;
      if (!token) {
        const cookieHeader = socket.handshake.headers.cookie ?? "";
        const match = cookieHeader.match(/nexplay_access_token=([^;]+)/);
        if (match) token = decodeURIComponent(match[1]);
      }
      if (!token) return next(new Error("Unauthorized: missing access token"));

      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;

      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true } });
      socket.data.role = user?.role ?? "PLAYER";
      next();
    } catch {
      next(new Error("Unauthorized: invalid or expired access token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    const role = socket.data.role as string;

    socket.join(ROOMS.user(userId));
    if (STAFF_ROLES.has(role)) socket.join(ROOMS.agents);

    // Presence: increment ref-count; broadcast online on first socket.
    const prev = presence.get(userId) ?? 0;
    presence.set(userId, prev + 1);
    if (prev === 0) {
      io?.emit(SOCKET_EVENTS.PRESENCE, { userId, online: true });
    }

    // ── Join / leave a conversation room ──
    socket.on(SOCKET_EVENTS.JOIN_CONVERSATION, (conversationId: string) => {
      if (typeof conversationId === "string") socket.join(ROOMS.conversation(conversationId));
    });
    socket.on(SOCKET_EVENTS.LEAVE_CONVERSATION, (conversationId: string) => {
      if (typeof conversationId === "string") socket.leave(ROOMS.conversation(conversationId));
    });

    // ── Typing indicators (broadcast to others in the room) ──
    socket.on(SOCKET_EVENTS.TYPING_START, (conversationId: string) => {
      socket.to(ROOMS.conversation(conversationId)).emit(SOCKET_EVENTS.TYPING, {
        conversationId,
        userId,
        typing: true,
      });
    });
    socket.on(SOCKET_EVENTS.TYPING_STOP, (conversationId: string) => {
      socket.to(ROOMS.conversation(conversationId)).emit(SOCKET_EVENTS.TYPING, {
        conversationId,
        userId,
        typing: false,
      });
    });

    // ── Delivery / read acknowledgements ──
    socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, async (payload: { messageId: string; conversationId: string }) => {
      try {
        await prisma.message.update({ where: { id: payload.messageId }, data: { deliveredAt: new Date() } });
        io?.to(ROOMS.conversation(payload.conversationId)).emit(SOCKET_EVENTS.MESSAGE_STATUS, {
          messageId: payload.messageId,
          status: "delivered",
        });
      } catch {
        /* message may have been deleted — ignore */
      }
    });

    socket.on(SOCKET_EVENTS.MESSAGE_READ, (payload: { conversationId: string }) => {
      socket.to(ROOMS.conversation(payload.conversationId)).emit(SOCKET_EVENTS.MESSAGE_STATUS, {
        conversationId: payload.conversationId,
        status: "read",
        byUserId: userId,
      });
    });

    socket.on("disconnect", () => {
      const count = (presence.get(userId) ?? 1) - 1;
      if (count <= 0) {
        presence.delete(userId);
        io?.emit(SOCKET_EVENTS.PRESENCE, { userId, online: false });
      } else {
        presence.set(userId, count);
      }
    });
  });

  return io;
}

export function getSocketServer() {
  return io;
}

export function isUserOnline(userId: string) {
  return isOnline(userId);
}
