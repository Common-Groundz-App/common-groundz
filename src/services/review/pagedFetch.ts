/**
 * Phase 11.4 — bounded, deterministic retrieval of a complete review set.
 *
 * PostgREST caps each response (commonly 1,000 rows), so omitting `.limit()`
 * never proves completeness. Pages are requested with a stable order and an
 * exact count; the set is accepted only when the deduplicated rows match the
 * count every page reported. Inserts/removals during retrieval change that
 * count (or leave a gap) and raise `ReviewDatasetIncompleteError` instead of
 * returning a silently partial list. Proportional to current scale; a
 * server-side ranking RPC is the documented next step for very large sets.
 */
export const REVIEW_PAGE_SIZE = 500;
export const HELPFUL_RPC_CHUNK_SIZE = 200;

export class ReviewDatasetIncompleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewDatasetIncompleteError';
  }
}

export type PageResult<T> = { data: T[] | null; error: unknown; count: number | null };

export const fetchAllRowsPaged = async <T extends { id: string }>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = REVIEW_PAGE_SIZE,
): Promise<T[]> => {
  const byId = new Map<string, T>();
  let expected: number | null = null;
  for (let from = 0; ; from += pageSize) {
    const { data, error, count } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    if (typeof count !== 'number') {
      throw new ReviewDatasetIncompleteError('Review count unavailable; completeness cannot be established');
    }
    if (expected === null) expected = count;
    else if (count !== expected) {
      throw new ReviewDatasetIncompleteError('Reviews changed during retrieval');
    }
    const rows = data || [];
    for (const row of rows) byId.set(row.id, row);
    if (rows.length < pageSize || from + pageSize >= expected) break;
  }
  if (byId.size !== expected) {
    throw new ReviewDatasetIncompleteError(`Expected ${expected} reviews, received ${byId.size}`);
  }
  return [...byId.values()];
};

export const chunkIds = <T>(ids: T[], size: number = HELPFUL_RPC_CHUNK_SIZE): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
};
