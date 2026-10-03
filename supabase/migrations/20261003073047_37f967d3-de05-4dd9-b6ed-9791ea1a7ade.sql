CREATE OR REPLACE FUNCTION public.get_entity_live_stats(p_entity_id uuid)
RETURNS TABLE(review_count integer, recommendation_count integer, average_rating numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      COALESCE(r.latest_rating, r.rating::numeric) AS effective_rating,
      r.is_recommended
    FROM reviews r
    JOIN entities e ON e.id = r.entity_id AND e.is_deleted = false
    WHERE r.entity_id = p_entity_id
      AND r.visibility = 'public'::recommendation_visibility
      AND r.status = 'published'
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  )
  SELECT count(*)::integer,
         (count(*) FILTER (WHERE is_recommended))::integer,
         round(avg(effective_rating), 1)::numeric(3,1)
  FROM canonical;
$$;
REVOKE ALL ON FUNCTION public.get_entity_live_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entity_live_stats(uuid) TO anon, authenticated, service_role;