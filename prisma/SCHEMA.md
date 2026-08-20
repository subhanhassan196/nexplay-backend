# NexPlay Database Schema — Phase 5 Documentation

This document explains every model added in Phase 5, why it exists, how
it relates to the rest of the schema, and the indexing/scaling
reasoning behind it. Phase 3 models (`User`, `Profile`, `UserSettings`,
`Session`, `RefreshToken`, `EmailVerificationToken`,
`PasswordResetToken`, `OAuthAccount`) are unchanged in shape — see
`schema.prisma`'s top comment block for the two purely-additive edits
made to `User` (bug fix + new optional fields/back-relations).

## Design Decisions (read this first)

1. **ID strategy**: Phase 3 models keep `cuid()`. Every Phase 5 model
   uses `uuid()`, per this phase's brief. Both are safe, globally
   unique, non-sequential primary keys — mixing "eras" is normal and
   doesn't require migrating existing data.
2. **No Role/Permission tables.** Phase 3/4 already implement RBAC via
   the `Role` enum embedded directly in JWT access tokens
   (`src/utils/jwt.ts`) and checked by `requireRole()`
   (`src/middlewares/auth.middleware.ts`). Adding dynamic DB-driven
   permissions now would silently break every already-issued token's
   trust model. This is explicitly an admin-panel-era concern (Phase
   12) and can be layered in additively later.
3. **Game.developer / Game.publisher are single relations**, not
   many-to-many — matches how the large majority of game catalogs
   actually work. Upgradeable later without touching unrelated tables.
4. **`CommunityLike` stores one row with optional `postId` OR
   `commentId`** rather than two tables. Postgres treats `NULL` as
   distinct in unique indexes, so the service layer (not the DB alone)
   must enforce "like this post/comment once per user." A Postgres
   partial unique index can harden this later via a raw-SQL migration.
5. **Denormalized/cached aggregate fields** (`Game.averageRating`,
   `Game.activePlayers`, `LeaderboardEntry.rank`) are intentional.
   Computing a live `AVG()`/`RANK()` over millions of rows on every
   page view does not scale; these are recomputed by scheduled jobs in
   later phases (the `jobs/` folder from Phase 4 is reserved for this).

## Model Reference

### Social Graph
| Model | Purpose |
|---|---|
| `FriendRequest` | Pending/accepted/declined friend invitations between two users. |
| `Friend` | A materialized, accepted friendship (one directional row per pair; repository merges both directions into a "friends list"). |
| `Follow` | Asymmetric follow (e.g. following a streamer without mutual friendship). |
| `Block` | Prevents a blocked user's content/requests from reaching the blocker; every future feed/DM/invite query must check this table. |

### Games Catalog
| Model | Purpose |
|---|---|
| `GameCategory` | Primary genre a game is filed under (Action, Strategy, etc.) — powers the frontend's category filter. |
| `GameTag` | Flexible many-to-many labels, looser than category (e.g. "co-op", "controller-support"). |
| `GameDeveloper` / `GamePublisher` | Studio/company reference data, reused across many games. |
| `Game` | The catalog entry itself. Cached aggregate fields avoid expensive joins on the hot catalog-listing path. |
| `GameMedia` | Screenshots/trailers/banners/icons — one game has many, ordered for display. |
| `GameReview` | Written review + a duplicated 1-5 rating (for display without a join). |
| `GameRating` | Lightweight quick-rate, separate from writing a review — different write frequency/pattern. |
| `FavoriteGame` | User's wishlist/favorites. |
| `RecentlyPlayed` | Powers a "Continue Playing" shelf; `playCount` + `lastPlayedAt` updated on each session. |

### Competitive Systems
| Model | Purpose |
|---|---|
| `Leaderboard` | A named ranking scope — global, per-game, or per-season (`gameId`/`season` both nullable for a platform-wide, all-time board). |
| `LeaderboardEntry` | One user's score within one leaderboard. `rank` is a cached snapshot, not computed live. |
| `Achievement` | Definition of an unlockable goal (platform-wide or game-scoped). |
| `UserAchievement` | Records that a specific user unlocked a specific achievement, and when. |
| `XPHistory` | Append-only ledger of every XP change — auditable, never just a mutable counter. |
| `Badge` / `UserBadge` | Cosmetic recognition, separate from achievements (badges can be awarded manually/via badges store in a later phase, not only earned). |
| `Tournament` | A competitive event tied to one game. `prizePoolCents` is a plain integer record — no payment processing exists yet. |
| `TournamentParticipant` | Registration record + status (registered/checked-in/disqualified/withdrawn). |
| `TournamentResult` | Final placement + (recorded, not paid) prize amount once a tournament ends. |

### Community
| Model | Purpose |
|---|---|
| `CommunityPost` | A feed post, optionally tied to a game. Soft-deletable (`deletedAt`) so moderation doesn't destroy audit trails. |
| `CommunityComment` | Threaded via self-relation `parentCommentId` for nested replies. |
| `CommunityLike` | See design decision #4 above. |
| `CommunityBookmark` | User's saved posts. |
| `CommunityReport` | Moderation queue entry; tracks who resolved it and when. |

### Notifications
| Model | Purpose |
|---|---|
| `Notification` | One row per notification instance sent to a user. `data` is a free-form JSON payload (e.g. `{ tournamentId }`) so the frontend can deep-link without extra schema per notification type. |
| `NotificationPreference` | Per-`NotificationType` opt-in/out across email/push/in-app — more granular than the coarse toggles already on `UserSettings`. |

### Platform / Support
| Model | Purpose |
|---|---|
| `Announcement` | Site-wide banners/news, publishable with an optional expiry. |
| `FAQ` | Public help-center content, categorized and orderable. |
| `SupportTicket` / `SupportReply` | Basic support-desk thread; `isInternal` on replies hides staff notes from the ticket owner. |
| `SiteSetting` | Generic key-value config store (`Json` value) for feature flags/settings that shouldn't need a schema migration to change. |
| `AuditLog` | Append-only security/admin action trail. `actorId` is nullable to allow logging system-initiated actions. |

### Avatars
| Model | Purpose |
|---|---|
| `Avatar` | A selectable catalog of default avatar images — distinct from `Profile.avatarUrl`, which is a user's own Cloudinary-uploaded image (Phase 4). |

## Indexing Strategy

Every foreign key has an index (Prisma does this automatically for
relation scalar fields in Postgres, but this schema also adds explicit
composite indexes for the query patterns each module will actually run):

- **Lookup by natural key**: `slug` fields (`games`, `game_categories`,
  `tournaments`, etc.) are `@unique`, which Postgres backs with a
  b-tree index automatically — these are the primary way the frontend
  fetches a single game/tournament by URL.
- **Feed/listing queries**: composite indexes like
  `CommunityPost(userId, createdAt)` and `Game(status)` /
  `Game(isFeatured)` / `Game(isTrending)` match exactly the `WHERE`
  + `ORDER BY` shape a paginated listing query uses (see
  `src/utils/apiFeatures.ts` from Phase 4).
- **Leaderboard ranking**: `LeaderboardEntry(leaderboardId, score DESC)`
  is a descending composite index — the single most important index
  in the whole schema for keeping "top 100 by score" queries fast as
  entries grow into the millions, since Postgres can read the
  already-sorted index instead of sorting at query time.
- **Notifications**: `(userId, isRead)` and `(userId, createdAt)` match
  "unread count" and "notification feed" respectively — the two
  queries a bell icon actually needs.
- **Audit/report queues**: indexed by `status` and by
  `(entityType, entityId)` so moderation/investigation queries don't
  scan the whole table.

## Migration Workflow

1. **Local development**: `npm run prisma:migrate` (wraps
   `prisma migrate dev`) — generates a new migration file under
   `prisma/migrations/`, applies it to your local database, and
   regenerates the Prisma Client.
2. **Naming the first Phase 5 migration**: run
   `npx prisma migrate dev --name phase5_expand_schema` so the
   migration history clearly documents when each set of tables landed.
3. **Seeding**: `npm run prisma:seed` (or automatically after
   `migrate dev` — Prisma runs the configured seed script once per
   `migrate dev` call by default). Seed logic lives in `prisma/seed.ts`
   and is fully idempotent (`upsert` everywhere), so it's safe to
   re-run in CI on every deploy.
4. **Production deploys**: use `prisma migrate deploy` (not `dev`) —
   it applies already-generated, already-reviewed migration files
   without prompting or generating new ones, which is what a CI/CD
   pipeline (Phase 14) should call.
5. **Never edit an already-applied migration file.** If a mistake ships,
   write a new migration that corrects it — Postgres migration history
   is meant to be an append-only log, exactly like `AuditLog` above.

## Scaling Strategy

- **Read-heavy hot paths use cached aggregates** (`Game.averageRating`,
  `activePlayers`, `LeaderboardEntry.rank`) instead of live
  aggregation, so the database does expensive computation once (in a
  background job) instead of on every request.
- **UUID primary keys** avoid the "hot last page" write-contention
  problem sequential integer IDs cause once traffic is distributed
  across multiple app servers/regions.
- **Composite indexes are shaped around actual query patterns**
  (see above), not added blindly — every index also costs write
  throughput, so this schema only indexes what the application layer
  (Phase 6+) is expected to actually query by.
- **Soft deletes (`deletedAt`) on high-value, moderatable content**
  (`User`, `Game`, `CommunityPost`, `CommunityComment`) preserve
  referential integrity and audit history instead of cascading hard
  deletes through a social graph.
- **Horizontal scaling readiness**: no table design here assumes a
  single Postgres instance forever — `Notification`, `AuditLog`, and
  `XPHistory` are natural append-heavy candidates for future
  partitioning (e.g. by `createdAt` month) once volume warrants it,
  without any application-code changes required to adopt partitioning
  at the Postgres level.
- **Redis (already configured in `src/config/redis.ts` since Phase 4)**
  is the intended cache layer in front of the hottest reads (leaderboard
  top-N, trending games) once real traffic materializes — the schema
  doesn't need to change to add that cache, only a read-through layer
  in the repository functions.
