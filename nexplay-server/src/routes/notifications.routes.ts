import { createPlaceholderModule } from "@/routes/placeholderModule";

/**
 * Reserved for Phase 10 (Notification System — Email + Push +
 * Real-Time). Will consume the Socket.IO server already bootstrapped
 * in config/socket.ts and the Redis client in config/redis.ts.
 */
export const notificationsRoutes = createPlaceholderModule("Notifications", [
  { method: "get", path: "/" },
  { method: "post", path: "/:id/read" },
]);
