/**
 * Generic repository contract. Concrete repositories (user.repository.ts,
 * profile.repository.ts, and Phase 6+ game/tournament repositories)
 * don't currently implement this interface explicitly — Prisma's
 * generated client already gives strong per-model types — but it's
 * defined here so a future dependency-injection container (e.g.
 * swapping Prisma for a different data layer in tests) has a contract
 * to target without touching service-layer code.
 */
export interface IRepository<TEntity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  findMany(args?: unknown): Promise<TEntity[]>;
  create(data: unknown): Promise<TEntity>;
  update(id: TId, data: unknown): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}
