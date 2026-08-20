# ─────────────────────────────────────────────────────────────
# NexPlay API — production Dockerfile (multi-stage, non-root)
# ─────────────────────────────────────────────────────────────

# Stage 1: install deps + build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps (including dev) for the build.
COPY package*.json ./
RUN npm ci

# Generate Prisma client + compile TS.
COPY . .
RUN npx prisma generate
RUN npm run build

# Prune dev dependencies for a lean runtime image.
RUN npm prune --omit=dev

# Stage 2: minimal runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user for safety.
RUN addgroup -S nexplay && adduser -S nexplay -G nexplay

# Copy only what's needed to run.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

USER nexplay

EXPOSE 5000

# Basic container healthcheck hitting the liveness endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]
