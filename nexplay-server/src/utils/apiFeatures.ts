import { z } from "zod";
import { PAGINATION_DEFAULTS } from "@/constants/config";

/**
 * Shared query-string schema for any paginated/listable endpoint
 * (Phase 6+ games catalog, Phase 7 community feed, Phase 9 tournament
 * listings, etc.). Controllers parse `req.query` with this once and
 * pass the result to `buildListQuery` to get ready-to-spread Prisma
 * `skip/take/orderBy` args — no module re-implements pagination.
 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULTS.PAGE),
  limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).default(PAGINATION_DEFAULTS.LIMIT),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().trim().optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function buildPaginationMeta(params: { page: number; limit: number; totalItems: number }): PaginationMeta {
  const { page, limit, totalItems } = params;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Translates a parsed `ListQuery` into Prisma's `skip`/`take`/`orderBy`
 * shape. `allowedSortFields` guards against sorting by an arbitrary
 * (potentially non-indexed or non-existent) column from user input.
 */
export function buildListQuery<TSortField extends string>(
  query: ListQuery,
  allowedSortFields: readonly TSortField[],
  defaultSortField: TSortField
) {
  const sortField = allowedSortFields.includes(query.sortBy as TSortField)
    ? (query.sortBy as TSortField)
    : defaultSortField;

  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    orderBy: { [sortField]: query.sortOrder },
  };
}

/**
 * Builds a case-insensitive Prisma `OR` contains-filter across the
 * given fields from `query.search`, or `undefined` if no search term
 * was provided (so callers can safely spread it into a `where` clause).
 */
export function buildSearchFilter(search: string | undefined, fields: string[]) {
  if (!search) return undefined;
  return {
    OR: fields.map((field) => ({ [field]: { contains: search, mode: "insensitive" as const } })),
  };
}
