/**
 * Phase 4.2B.3 — shared constants for the v2 trending value.
 *
 * `entities.trending_score_v2` is bounded [0, 1.2] by the frozen scoring
 * contract and by a database CHECK constraint. Consumers must:
 *
 *   - ORDER BY it (never gate a surface on an absolute threshold), and
 *   - divide by `TRENDING_V2_BOUND` before blending it with other 0–1 signals,
 *     so existing blend weights keep their meaning.
 *
 * The value is written exclusively by the server-side orchestrator
 * (`update_all_trending_scores_v2`). No browser code writes it.
 */
export const TRENDING_V2_BOUND = 1.2;

/** Normalise a stored v2 trending value into [0, 1]. */
export const normalizeTrendingV2 = (value: number | null | undefined): number => {
  const raw = Number(value) || 0;
  if (raw <= 0) return 0;
  return Math.min(raw, TRENDING_V2_BOUND) / TRENDING_V2_BOUND;
};

/**
 * Bucket membership for "trending" groupings. Membership only — it never
 * decides whether a surface renders; empty trending buckets are allowed and the
 * remaining buckets fill the surface.
 */
export const isTrendingV2 = (value: number | null | undefined): boolean =>
  (Number(value) || 0) > 0;
