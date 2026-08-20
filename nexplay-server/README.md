# NexPlay Server — Phase 3 (Authentication & User Management)

Production-grade Express + TypeScript + Prisma + PostgreSQL backend
for NexPlay. Auth and user-management only, by design — no wallet,
rewards, tournaments, games, or admin panel logic lives here.

## Tech Stack

Express · TypeScript · Prisma ORM · PostgreSQL · JWT · bcrypt · Zod ·
Nodemailer · Cloudinary (config-ready) · Redis (architecture-ready) ·
Socket.IO (architecture-ready)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in at minimum: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   (generate with `openssl rand -base64 64`), and SMTP credentials if you
   want real emails to send (otherwise emails will fail silently and
   just get logged — auth still works, you just won't receive the mail).

3. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
   Requires a running PostgreSQL instance matching `DATABASE_URL`.

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   API available at `http://localhost:5000/api/v1`.

## Folder Structure

```
src/
  config/        # env, db (Prisma), redis, socket, cloudinary, cors
  controllers/    # thin HTTP layer — calls services, shapes responses
  services/        # business logic (auth, token, email)
  repositories/     # Prisma data-access layer
  middlewares/       # validate, auth guard, rate limit, error handler
  routes/              # auth.routes.ts, oauth.routes.ts, index.ts
  validators/           # Zod schemas
  utils/                 # jwt, hash, cookies, ApiError, ApiResponse, asyncHandler
  dtos/                   # sanitized API response shapes (never leak passwordHash)
  app.ts                   # Express app + middleware pipeline
  server.ts                 # boot: Prisma connect, Redis connect, HTTP + Socket.IO listen
prisma/
  schema.prisma              # User, Profile, Session, RefreshToken, etc.
```

## Auth Flow Summary

- **Register** → creates User + Profile + Settings, sends verification email
- **Login** → validates credentials, checks account lock, issues access
  (15m) + refresh (7d / 30d remember-me) tokens as httpOnly cookies
- **Refresh** → rotates the refresh token on every use; reuse of an
  already-rotated token revokes the entire session tree (theft protection)
- **Logout** → revokes the session + refresh token, clears cookies
- **Forgot/Reset Password** → single-use, 30-minute token; resetting
  revokes all other active sessions
- **Email Verification** → single-use, 24-hour token
- **Account Lockout** → after `MAX_FAILED_LOGIN_ATTEMPTS` (default 5),
  account locks for `ACCOUNT_LOCK_DURATION_MINUTES` (default 15)

## What's Prepared But Not Activated

- **Redis** (`src/config/redis.ts`) — connects if `REDIS_URL` is set;
  ready for rate-limit store, presence cache, OTP cache in later phases
- **Socket.IO** (`src/config/socket.ts`) — JWT-authenticated handshake
  wired up; no gameplay/chat event handlers (out of Phase 3 scope)
- **Google/Discord OAuth** (`src/routes/oauth.routes.ts`) — routes,
  env vars, and the `OAuthAccount` Prisma model exist; the actual
  provider exchange returns `501 Not Implemented` until real client
  credentials + a strategy library are added
- **Cloudinary** (`src/config/cloudinary.ts`) — configures automatically
  once `CLOUDINARY_*` env vars are set; no upload endpoint yet (Profile
  model already has `avatarUrl`/`bannerUrl` fields ready for it)

## Phase 4 Additions (Enterprise Backend Architecture)

On top of Phase 3's auth system, this phase adds the scalable
foundation every later phase builds on:

- **`errors/`** — named error classes (`ValidationError`, `NotFoundError`,
  `ForbiddenError`, `ConflictError`, `NotImplementedError`, etc.), all
  built on the existing `ApiError` base — zero breaking changes to the
  error-handling pipeline
- **`lib/logger.ts`** — structured console + daily-rotating file logging
  (`logs/app-*.log`, `logs/error-*.log`); Morgan HTTP access logs pipe
  through the same transport
- **`constants/`** — HTTP status codes, role hierarchy (`hasMinimumRole`),
  pagination/cache/upload limits — no magic numbers scattered around
- **`utils/apiFeatures.ts`** — one reusable pagination + sorting +
  filtering + searching query builder for every future list endpoint
- **`helpers/`** — XSS-safe text sanitization, object whitelisting
  (`pick`/`omitUndefined`) so update endpoints can never be used to
  smuggle in protected fields like `role`
- **`interfaces/`** — DI-ready contracts (`IRepository`, `IAuthService`)
  so a future test suite can mock behind an interface, not a concrete class
- **Request tracing** — every request gets a `requestId` (echoed as
  `X-Request-Id`), for correlating log lines once traffic is high
- **File uploads** — Multer (memory storage, strict size/mime
  validation) + a Cloudinary streaming service, wired into a real
  **Users/Profile module**: `GET/PATCH /api/v1/users/me/profile`,
  `GET/PATCH /api/v1/users/me/settings`, `POST /api/v1/users/me/avatar`,
  `POST /api/v1/users/me/banner`
- **Reserved module architecture** — `/api/v1/games`, `/categories`,
  `/leaderboard`, `/rewards`, `/notifications`, `/community` are real,
  fully-wired Express routers (same middleware pipeline as everything
  else) that return a clean `501 Not Implemented` until their
  respective phase (6-10) replaces the handler body with real logic.
  The route paths and response envelope are final now — no frontend
  rewiring needed later, just backend implementation.

### Security patches applied this phase
- `multer` pinned to `^2.0.1` (1.x has known vulnerabilities)
- `nodemailer` bumped to `^9.0.3` (patches multiple SMTP injection / SSRF advisories)
- `npm audit`: **0 vulnerabilities**

## Phase 5 Additions (Database Design)

`prisma/schema.prisma` expanded from 8 to 46 models (16 enums) covering
social graph, games catalog, leaderboards, achievements/XP/badges,
tournaments, community, notifications, and support/admin tables — all
purely additive to Phase 3's auth schema. **Full model-by-model
documentation, relationship rationale, indexing strategy, and scaling
strategy live in [`prisma/SCHEMA.md`](./prisma/SCHEMA.md) — read that
file before touching the schema.**

Quick facts:
- Every new model uses `uuid()` primary keys (Phase 3 models keep `cuid()` — see SCHEMA.md for why)
- One real bug fix: `User.createdAt` was incorrectly re-stamped via `@updatedAt`; fixed to a plain `@default(now())`
- No Role/Permission tables — RBAC stays enum + JWT-based (Phase 3/4 compatibility), see SCHEMA.md decision #2
- No wallet/payment/gambling tables, per this phase's brief — `Tournament.prizePoolCents` is a record-only integer field, no payment processing

### Apply the schema

```bash
npx prisma generate
npx prisma migrate dev --name phase5_expand_schema
npm run prisma:seed
```

`prisma:seed` is idempotent — safe to re-run. It creates a `SUPER_ADMIN`
user (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars, with safe
defaults if unset — **change the default password before any shared/
production use**), game categories, badges, achievements, sample games,
and FAQs.

## Global Support Messenger (Mega Phase — Backend)

The per-game chat concept was replaced by a single **global support
messenger**: one conversation per user (enforced by a unique index),
opened from a floating button on every page — not tied to any game.

- **Models**: `Conversation` (1:1 with user), `Message`
  (reply/edit/delete/reactions-ready), `MessageReaction`,
  `MessageReadStatus`, `QuickLink`, `Announcement`, `SupportSetting`.
  Enums: `ConversationState`, `MessageSenderType`, `QuickLinkCategory`.
- **User APIs** (`/api/v1/messenger`, auth required): `GET /bootstrap`
  (welcome + quick links + announcements + support status), `GET
  /conversation`, `GET /messages`, `POST /messages`, `PATCH
  /messages/:id`, `DELETE /messages/:id`, `POST
  /messages/:id/reactions`, `POST /read`.
- **Admin APIs** (`/api/v1/admin/support`, MODERATOR+): list/get
  conversations, reply, set state, assign, pin, delete; full CRUD for
  quick links, announcements, and support settings.

All messenger content (welcome message, quick links, announcements,
support hours/online status) is admin-configurable — nothing is
hardcoded in the UI. No AI/live-agent auto-responder is wired yet; the
schema is ready for replies from AGENT/SYSTEM/BOT senders.

## Chat Entry System (Product Pivot)

Per the approved roadmap pivot, games are accessed via AI/human **chat**
rather than played in-platform. This adds:

- **Models**: `Conversation`, `Message` (+ enums `ConversationMode`,
  `ConversationStatus`, `MessageSenderType`) — additive, Phase 6.1
  game models left untouched.
- **APIs** (all under `/api/v1/conversations`, all auth-required):
  - `POST /conversations` — start a chat for a game (mode: AI | HUMAN)
  - `GET /conversations` — list my conversations (paginated, status filter)
  - `GET /conversations/:id` — one conversation + its messages (paginated)
  - `POST /conversations/:id/messages` — send a message
  - `PATCH /conversations/:id` — change status (resolve/archive)

**Deliberately NOT wired yet** (reserved for later phases per the brief):
no AI provider is called, and no human-agent dashboard exists. A sent
message simply persists; a later phase attaches the responder. The
schema is designed so that requires zero migration (AI/agent replies
are just `Message` rows with a different `senderType`).

## Next Steps (Phase 6+)

## Connecting the Frontend

The `nexplay` frontend expects this API at `NEXT_PUBLIC_API_URL`
(default `http://localhost:5000/api/v1`, see `nexplay/.env.local.example`).
CORS is configured to allow credentials from `CLIENT_URL` only.
