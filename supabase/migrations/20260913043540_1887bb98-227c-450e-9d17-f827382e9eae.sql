-- The return type gains a trending_score column, so the old function must be replaced.
-- DROP without CASCADE: if anything unexpectedly depends on this function, the migration
-- must fail loudly rather than silently drop the dependent object.
DROP FUNCTION IF EXISTS public.get_fallback_entity_recommendations(uuid, uuid, integer);

CREATE FUNCTION public.get_fallback_entity_recommendations(p_entity_id uuid, p_current_user_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 6)
 RETURNS TABLE(entity_id uuid, entity_name text, entity_type text, entity_image_url text, entity_slug text, avg_rating numeric, recommendation_count integer, display_reason text, trending_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- Phase 4.2B.3: SECURITY DEFINER and callable by anon/authenticated, so the
  -- caller-supplied size is clamped. The upper bound is the client-side bucket
  -- pool size (50); the client widens its own fetch and buckets locally in the
  -- same cutover, so the rating-ranked pre-limit can no longer discard trending
  -- candidates.
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 6), 50));
BEGIN
  -- p_current_user_id is accepted for contract compatibility and intentionally unused (4.5 removes it).
  RETURN QUERY
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.entity_id,
      r.user_id,
      COALESCE(r.latest_rating, r.rating) AS effective_rating,
      r.is_recommended
    FROM public.reviews r
    WHERE r.status = 'published'
      AND r.visibility = 'public'
      AND r.entity_id IS NOT NULL
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  ),
  entity_stats AS (
    -- avg_rating = overall public average over ALL canonical rows (may be NULL
    -- when every canonical review lacks a rating; NULLS LAST keeps unrated
    -- entities below rated ones under DESC ordering).
    -- rec_count  = people whose canonical row recommends.
    SELECT
      c.entity_id,
      ROUND(AVG(c.effective_rating), 1) AS avg_rating,
      COUNT(*) FILTER (WHERE c.is_recommended = true)::INTEGER AS rec_count
    FROM canonical c
    GROUP BY c.entity_id
    HAVING COUNT(*) FILTER (WHERE c.is_recommended = true) >= 1
  )
  SELECT
    e.id,
    e.name,
    e.type::TEXT,
    e.image_url,
    e.slug,
    es.avg_rating,
    es.rec_count,
    CASE
      WHEN es.avg_rating >= 4.5 THEN 'Highly rated'
      WHEN es.rec_count >= 5 THEN 'Popular choice'
      ELSE 'Well reviewed'
    END AS display_reason,
    e.trending_score_v2::NUMERIC
  FROM entity_stats es
  JOIN public.entities e ON e.id = es.entity_id
  WHERE e.is_deleted = false
    AND e.id != p_entity_id
  ORDER BY es.avg_rating DESC NULLS LAST, es.rec_count DESC, e.id ASC
  LIMIT v_limit;
END;
$function$;

-- SECURITY DEFINER: ownership must be postgres, not whichever role ran the migration.
ALTER FUNCTION public.get_fallback_entity_recommendations(uuid, uuid, integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_fallback_entity_recommendations(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fallback_entity_recommendations(uuid, uuid, integer) TO anon, authenticated, service_role;