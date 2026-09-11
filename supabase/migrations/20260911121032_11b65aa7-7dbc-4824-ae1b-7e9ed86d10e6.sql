-- Phase 4.2A — recommendation-truth migration (reviewer-corrected)
-- Frozen rules:
--  1. Visibility filter (public only this phase) BEFORE canonical selection.
--  2. Canonical row per (user_id, entity_id): created_at DESC NULLS LAST, id DESC.
--  3. Shared selection, NOT shared filtering: averages use every canonical visible
--     rating (including non-recommenders); endorsement counts/lists filter to
--     is_recommended = true on the canonical row.

-- 1. Fallback surface: same signature and eight return columns, body now reads reviews.
CREATE OR REPLACE FUNCTION public.get_fallback_entity_recommendations(p_entity_id uuid, p_current_user_id uuid DEFAULT NULL, p_limit integer DEFAULT 6)
RETURNS TABLE(entity_id uuid, entity_name text, entity_type text, entity_image_url text, entity_slug text, avg_rating numeric, recommendation_count integer, display_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- avg_rating = overall public average over ALL canonical rows.
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
    END AS display_reason
  FROM entity_stats es
  JOIN public.entities e ON e.id = es.entity_id
  WHERE e.is_deleted = false
    AND e.id != p_entity_id
  ORDER BY es.avg_rating DESC, es.rec_count DESC, e.id ASC
  LIMIT p_limit;
END;
$function$;
ALTER FUNCTION public.get_fallback_entity_recommendations(uuid, uuid, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_fallback_entity_recommendations(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fallback_entity_recommendations(uuid, uuid, integer) TO anon, authenticated;

-- 2. Active v4 Circle discovery overload: identity-enforced, public-only, canonical rows,
--    effective ratings, overall circle average, aligned recommender arrays.
CREATE OR REPLACE FUNCTION public.get_aggregated_network_recommendations_discovery(p_user_id uuid, p_entity_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(entity_id uuid, entity_name text, entity_type entity_type, entity_image_url text, entity_slug text, parent_id uuid, parent_slug text, average_rating numeric, recommendation_count integer, recommender_user_ids uuid[], recommender_usernames text[], recommender_avatars text[], latest_recommendation_date timestamp with time zone, network_score double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'viewer identity mismatch' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH user_network AS (
    SELECT following_id AS network_user_id
    FROM public.follows
    WHERE follower_id = p_user_id
  ),
  canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.entity_id,
      r.user_id AS recommender_id,
      COALESCE(r.latest_rating, r.rating) AS effective_rating,
      r.is_recommended,
      r.created_at
    FROM public.reviews r
    INNER JOIN user_network un ON r.user_id = un.network_user_id
    WHERE r.status = 'published'
      AND r.visibility = 'public'
      AND r.entity_id IS NOT NULL
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  ),
  -- Circle average over ALL canonical rows (people who answered "no" included).
  entity_avg AS (
    SELECT c.entity_id, ROUND(AVG(c.effective_rating), 1) AS avg_rating
    FROM canonical c
    GROUP BY c.entity_id
  ),
  -- Endorsers only: counts, arrays, recency, score.
  network_reviews AS (
    SELECT
      c.entity_id,
      c.recommender_id,
      c.effective_rating,
      c.created_at,
      (SELECT COUNT(*) FROM public.follows WHERE following_id = c.recommender_id) * 0.1 +
      (c.effective_rating / 5.0) * 0.9 AS influence_score
    FROM canonical c
    WHERE c.is_recommended = true
  ),
  -- One shared deterministic ordering (username, id) for all three parallel arrays.
  ordered_recommenders AS (
    SELECT
      nr.entity_id,
      p.id AS recommender_id,
      p.username,
      p.avatar_url,
      ROW_NUMBER() OVER (PARTITION BY nr.entity_id ORDER BY p.username NULLS LAST, p.id) AS rn
    FROM network_reviews nr
    JOIN public.profiles p ON p.id = nr.recommender_id
  ),
  recommender_arrays AS (
    SELECT
      o.entity_id,
      ARRAY_AGG(o.recommender_id ORDER BY o.rn) AS rec_user_ids,
      ARRAY_AGG(o.username ORDER BY o.rn) AS rec_usernames,
      ARRAY_AGG(o.avatar_url ORDER BY o.rn) AS rec_avatars
    FROM ordered_recommenders o
    GROUP BY o.entity_id
  ),
  aggregated_data AS (
    SELECT
      nr.entity_id,
      COUNT(DISTINCT nr.recommender_id)::INTEGER AS rec_count,
      MAX(nr.created_at) AS latest_date,
      SUM(
        nr.influence_score *
        EXP(-EXTRACT(days FROM (now() - nr.created_at)) / 30.0)
      )::double precision AS net_score
    FROM network_reviews nr
    GROUP BY nr.entity_id
    HAVING COUNT(DISTINCT nr.recommender_id) >= 1
  )
  SELECT
    e.id AS entity_id,
    e.name AS entity_name,
    e.type AS entity_type,
    e.image_url AS entity_image_url,
    e.slug AS entity_slug,
    parent_entity.id AS parent_id,
    parent_entity.slug AS parent_slug,
    ea.avg_rating AS average_rating,
    ad.rec_count AS recommendation_count,
    ra.rec_user_ids AS recommender_user_ids,
    ra.rec_usernames AS recommender_usernames,
    ra.rec_avatars AS recommender_avatars,
    ad.latest_date AS latest_recommendation_date,
    ad.net_score AS network_score
  FROM aggregated_data ad
  JOIN entity_avg ea ON ea.entity_id = ad.entity_id
  JOIN recommender_arrays ra ON ra.entity_id = ad.entity_id
  INNER JOIN public.entities e ON ad.entity_id = e.id
  LEFT JOIN public.entities parent_entity ON e.parent_id = parent_entity.id
  WHERE e.is_deleted = false
    AND e.id != p_entity_id
  ORDER BY ad.net_score DESC, ad.latest_date DESC, e.id ASC
  LIMIT p_limit;
END;
$function$;
ALTER FUNCTION public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer) TO authenticated;

-- 3. Circle rating: average effective rating over ALL canonical visible rows — no endorsement filter.
CREATE OR REPLACE FUNCTION public.get_circle_rating(p_entity_id uuid, p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  avg_rating DECIMAL(2,1);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'viewer identity mismatch' USING ERRCODE = '42501';
  END IF;

  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id)
      r.user_id,
      COALESCE(r.latest_rating, r.rating) AS effective_rating
    FROM public.reviews r
    WHERE r.entity_id = p_entity_id
      AND r.status = 'published'
      AND r.visibility = 'public'
      AND r.user_id IN (
        SELECT following_id FROM public.follows WHERE follower_id = p_user_id
      )
    ORDER BY r.user_id, r.created_at DESC NULLS LAST, r.id DESC
  )
  SELECT ROUND(AVG(c.effective_rating), 1) INTO avg_rating
  FROM canonical c;

  RETURN COALESCE(avg_rating, 0.0);
END;
$function$;
ALTER FUNCTION public.get_circle_rating(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_circle_rating(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_circle_rating(uuid, uuid) TO authenticated;

-- 4. Circle recommendation count: endorsing people, canonical rows, public only.
CREATE OR REPLACE FUNCTION public.get_circle_recommendation_count(p_entity_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'viewer identity mismatch' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH canonical AS (
      SELECT DISTINCT ON (r.user_id)
        r.user_id,
        r.is_recommended
      FROM public.reviews r
      WHERE r.entity_id = p_entity_id
        AND r.status = 'published'
        AND r.visibility = 'public'
        AND r.user_id IN (
          SELECT following_id FROM public.follows WHERE follower_id = p_user_id
        )
      ORDER BY r.user_id, r.created_at DESC NULLS LAST, r.id DESC
    )
    SELECT COUNT(*)::INTEGER FROM canonical WHERE is_recommended = true
  );
END;
$function$;
ALTER FUNCTION public.get_circle_recommendation_count(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_circle_recommendation_count(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_circle_recommendation_count(uuid, uuid) TO authenticated;

-- 5. Circle recommendation counts (batch): same rule, many entities.
CREATE OR REPLACE FUNCTION public.get_circle_recommendation_counts_batch(p_entity_ids uuid[], p_user_id uuid)
RETURNS TABLE(entity_id uuid, circle_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'viewer identity mismatch' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.entity_id,
      r.user_id,
      r.is_recommended
    FROM public.reviews r
    WHERE r.entity_id = ANY(p_entity_ids)
      AND r.status = 'published'
      AND r.visibility = 'public'
      AND r.user_id IN (
        SELECT following_id FROM public.follows WHERE follower_id = p_user_id
      )
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  )
  SELECT
    c.entity_id,
    COUNT(*) FILTER (WHERE c.is_recommended = true)::INTEGER AS circle_count
  FROM canonical c
  GROUP BY c.entity_id;
END;
$function$;
ALTER FUNCTION public.get_circle_recommendation_counts_batch(uuid[], uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_circle_recommendation_counts_batch(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_circle_recommendation_counts_batch(uuid[], uuid) TO authenticated;

-- 6. Network activity gate.
-- FROZEN SEMANTICS: counts endorsement ACTIVITIES, i.e. canonical (person, entity)
-- pairs whose latest public review recommends. One person recommending five entities
-- contributes 5. This preserves the pre-migration meaning of the gate.
CREATE OR REPLACE FUNCTION public.has_network_activity(p_user_id uuid, p_min_count integer DEFAULT 3)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'viewer identity mismatch' USING ERRCODE = '42501';
  END IF;

  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.entity_id,
      r.user_id,
      r.is_recommended
    FROM public.reviews r
    JOIN public.entities e ON r.entity_id = e.id
    WHERE r.status = 'published'
      AND r.visibility = 'public'
      AND e.is_deleted = false
      AND r.user_id IN (
        SELECT following_id FROM public.follows WHERE follower_id = p_user_id
      )
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  )
  SELECT COUNT(*) INTO rec_count FROM canonical WHERE is_recommended = true;

  RETURN rec_count >= p_min_count;
END;
$function$;
ALTER FUNCTION public.has_network_activity(uuid, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_network_activity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_network_activity(uuid, integer) TO authenticated;

-- 7. Global recommending count: people, public reviews only.
CREATE OR REPLACE FUNCTION public.get_recommendation_count(p_entity_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    WITH canonical AS (
      SELECT DISTINCT ON (r.user_id)
        r.user_id,
        r.is_recommended
      FROM public.reviews r
      WHERE r.entity_id = p_entity_id
        AND r.status = 'published'
        AND r.visibility = 'public'
      ORDER BY r.user_id, r.created_at DESC NULLS LAST, r.id DESC
    )
    SELECT COUNT(*)::INTEGER FROM canonical WHERE is_recommended = true
  );
END;
$function$;
ALTER FUNCTION public.get_recommendation_count(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_recommendation_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recommendation_count(uuid) TO anon, authenticated;

-- 8. Global recommending counts (batch): adds the missing public-visibility filter.
CREATE OR REPLACE FUNCTION public.get_recommendation_counts_batch(p_entity_ids uuid[])
RETURNS TABLE(entity_id uuid, recommendation_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.entity_id,
      r.user_id,
      r.is_recommended
    FROM public.reviews r
    WHERE r.entity_id = ANY(p_entity_ids)
      AND r.status = 'published'
      AND r.visibility = 'public'
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  )
  SELECT
    c.entity_id,
    COUNT(*) FILTER (WHERE c.is_recommended = true)::INTEGER AS recommendation_count
  FROM canonical c
  GROUP BY c.entity_id;
END;
$function$;
ALTER FUNCTION public.get_recommendation_counts_batch(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_recommendation_counts_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recommendation_counts_batch(uuid[]) TO anon, authenticated;

-- 9. NEW: Recommenders list with SQL-side canonical selection, filtering and
-- fully deterministic pagination. SECURITY INVOKER: rows stay subject to existing RLS.
CREATE OR REPLACE FUNCTION public.get_entity_recommenders(
  p_entity_id uuid,
  p_search text DEFAULT NULL,
  p_relationship text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  username text,
  first_name text,
  last_name text,
  avatar_url text,
  is_following boolean,
  is_mutual boolean,
  recommended_at timestamp with time zone,
  rating numeric,
  latest_rating numeric,
  effective_rating numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id)
      r.user_id,
      r.is_recommended,
      r.created_at AS recommended_at,
      r.rating,
      r.latest_rating
    FROM public.reviews r
    WHERE r.entity_id = p_entity_id
      AND r.status = 'published'
      AND r.visibility = 'public'
    ORDER BY r.user_id, r.created_at DESC NULLS LAST, r.id DESC
  ),
  endorsers AS (
    SELECT
      c.user_id,
      c.recommended_at,
      c.rating,
      c.latest_rating,
      COALESCE(c.latest_rating, c.rating) AS effective_rating
    FROM canonical c
    WHERE c.is_recommended = true
  ),
  enriched AS (
    SELECT
      e.user_id,
      p.username,
      p.first_name,
      p.last_name,
      p.avatar_url,
      EXISTS(
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = e.user_id
      ) AS is_following,
      (
        EXISTS(
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid() AND f.following_id = e.user_id
        )
        AND EXISTS(
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = e.user_id AND f.following_id = auth.uid()
        )
      ) AS is_mutual,
      e.recommended_at,
      e.rating,
      e.latest_rating,
      e.effective_rating
    FROM endorsers e
    JOIN public.profiles p ON p.id = e.user_id
  )
  SELECT
    en.user_id AS id,
    en.username,
    en.first_name,
    en.last_name,
    en.avatar_url,
    en.is_following,
    en.is_mutual,
    en.recommended_at,
    en.rating,
    en.latest_rating,
    en.effective_rating
  FROM enriched en
  WHERE (
    p_relationship = 'all'
    OR (p_relationship = 'following' AND en.is_following)
    OR (p_relationship = 'mutual' AND en.is_mutual)
  )
  AND (
    p_search IS NULL
    OR en.username ILIKE '%' || p_search || '%'
    OR en.first_name ILIKE '%' || p_search || '%'
    OR en.last_name ILIKE '%' || p_search || '%'
  )
  ORDER BY
    en.is_following DESC,
    en.is_mutual DESC,
    en.recommended_at DESC NULLS LAST,
    en.user_id ASC
  LIMIT p_limit
  OFFSET p_offset;
$function$;
ALTER FUNCTION public.get_entity_recommenders(uuid, text, text, integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_entity_recommenders(uuid, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entity_recommenders(uuid, text, text, integer, integer) TO anon, authenticated;