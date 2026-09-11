CREATE MATERIALIZED VIEW public.entity_stats_v2 AS
WITH canonical AS (
  SELECT DISTINCT ON (r.user_id, r.entity_id)
    r.user_id,
    r.entity_id,
    COALESCE(r.latest_rating, r.rating) AS effective_rating,
    r.is_recommended
  FROM public.reviews r
  WHERE r.visibility = 'public'
    AND r.status = 'published'
    AND r.entity_id IS NOT NULL
  ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
),
agg AS (
  SELECT
    entity_id,
    COUNT(*)::INTEGER AS review_count,
    COUNT(*) FILTER (WHERE is_recommended)::INTEGER AS recommendation_count,
    ROUND(AVG(effective_rating)::NUMERIC, 1)::NUMERIC(3,1) AS average_rating
  FROM canonical
  GROUP BY entity_id
)
SELECT
  e.id AS entity_id,
  COALESCE(a.recommendation_count, 0)::INTEGER AS recommendation_count,
  COALESCE(a.review_count, 0)::INTEGER AS review_count,
  a.average_rating
FROM public.entities e
LEFT JOIN agg a ON a.entity_id = e.id
WHERE e.is_deleted = false;

COMMENT ON MATERIALIZED VIEW public.entity_stats_v2 IS
'Phase 4.2B.0. Canonicalise first, then aggregate: public+published reviews -> one current row per (user_id, entity_id) ordered created_at DESC NULLS LAST, id DESC -> counts and average. review_count = distinct current public reviewers; recommendation_count = those whose canonical review has is_recommended = true; average_rating = average effective rating (COALESCE(latest_rating, rating)) of ALL canonical reviewers, including non-recommenders. The legacy public.recommendations table contributes nothing.';

ALTER MATERIALIZED VIEW public.entity_stats_v2 OWNER TO postgres;

CREATE UNIQUE INDEX idx_entity_stats_v2_entity_id ON public.entity_stats_v2(entity_id);
CREATE INDEX idx_entity_stats_v2_avg_rating ON public.entity_stats_v2(average_rating DESC NULLS LAST);

GRANT SELECT ON public.entity_stats_v2 TO authenticated;
GRANT SELECT ON public.entity_stats_v2 TO anon;

DO $schedule$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh-entity-stats-v2-hourly'
  ) THEN
    PERFORM cron.schedule(
      'refresh-entity-stats-v2-hourly',
      '5 * * * *',
      $job$REFRESH MATERIALIZED VIEW CONCURRENTLY public.entity_stats_v2$job$
    );
  END IF;
END
$schedule$;

CREATE OR REPLACE FUNCTION public.get_user_recommendation_counts_batch(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, recommendation_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.user_id,
      r.entity_id,
      r.is_recommended
    FROM public.reviews r
    WHERE r.user_id = ANY(p_user_ids)
      AND r.visibility = 'public'
      AND r.status = 'published'
      AND r.entity_id IS NOT NULL
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  )
  SELECT u AS user_id,
         COALESCE((
           SELECT COUNT(*)::INTEGER
           FROM canonical c
           WHERE c.user_id = u AND c.is_recommended
         ), 0) AS recommendation_count
  FROM UNNEST(p_user_ids) AS u;
$$;

COMMENT ON FUNCTION public.get_user_recommendation_counts_batch(uuid[]) IS
'Phase 4.2B.0. Number of distinct items each person currently recommends via their canonical public published review. Public directory surface: public visibility only.';

ALTER FUNCTION public.get_user_recommendation_counts_batch(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_user_recommendation_counts_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_recommendation_counts_batch(uuid[]) TO anon, authenticated;