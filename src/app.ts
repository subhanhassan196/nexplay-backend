import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import { corsOptions } from "@/config/cors";
import { generalRateLimiter } from "@/middlewares/rateLimiter.middleware";
import { errorHandler, notFoundHandler } from "@/middlewares/errorHandler.middleware";
import { requestLogger } from "@/middlewares/requestLogger.middleware";
import { requestId } from "@/middlewares/requestId.middleware";
import { apiRouter } from "@/routes";
import { isProd } from "@/config/env";
import { logger } from "@/lib/logger";
import path from "path";
import { LOCAL_UPLOAD_ROUTE } from "@/services/storage.service";

export const app = express();

// Trust the first proxy hop (needed for correct req.ip behind a load
// balancer / reverse proxy in production, and for secure cookies).
app.set("trust proxy", 1);

app.use(requestId);

// ── Security ──────────────────────────────────────
app.use(helmet({
  // Images and audio are loaded cross-origin by the frontend, which the
  // default same-origin resource policy would block.
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Serves locally-stored uploads when Cloudinary isn't configured.
app.use(LOCAL_UPLOAD_ROUTE, express.static(path.resolve(process.cwd(), "uploads")));
app.use(cors(corsOptions));
app.use(generalRateLimiter);

// ── Parsing ───────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(compression());
app.use(express.static("public"));

// ── Logging ───────────────────────────────────────
app.use(requestLogger);

logger.info(`Logging pipeline initialized [${isProd ? "production" : "development"}]`);

// ── Routes ────────────────────────────────────────
app.use("/api/v1", apiRouter);

// ── 404 + Error handling (must be last) ──────────
app.use(notFoundHandler);
app.use(errorHandler);
