/**
 * Picks only the given keys from an object — used to whitelist which
 * fields a PATCH/PUT endpoint is allowed to update, so a client can
 * never smuggle in fields like `role` or `isEmailVerified` through a
 * profile-update payload.
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

/** Removes keys with `undefined` values — useful before Prisma `update` calls. */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}
