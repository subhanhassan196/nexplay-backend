import http from "http";
import os from "os";
import { app } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/config/db";
import { connectRedis } from "@/config/redis";
import { initSocketServer } from "@/config/socket";
import { registerJobHandlers } from "@/jobs/handlers";
import { startScheduler } from "@/jobs/scheduler";

async function main() {
  await prisma.$connect();
  console.log("✅ PostgreSQL connected (via Prisma)");

  await connectRedis();

  // Background jobs: register handlers, then start the periodic scheduler.
  registerJobHandlers();
  startScheduler();

  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.PORT, "0.0.0.0", () => {
    console.log(`🚀 NexPlay API running on ${env.API_URL} [${env.NODE_ENV}]`);
    // Print reachable LAN addresses so you can open the app from a phone
    // or a colleague's machine on the same Wi-Fi without hunting for the IP.
    try {
      const nets = os.networkInterfaces();
      const lanIps: string[] = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] ?? []) {
          if (net.family === "IPv4" && !net.internal) lanIps.push(net.address);
        }
      }
      if (lanIps.length) {
        console.log("🌐 Reachable on your network at:");
        for (const ip of lanIps) {
          console.log(`   • API:      http://${ip}:${env.PORT}`);
          console.log(`   • Frontend: http://${ip}:3000`);
        }
      }
    } catch {
      /* best-effort — never block startup on IP discovery */
    }
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("🔥 Unhandled promise rejection:", reason);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});

main().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
