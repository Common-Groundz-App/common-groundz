-- Phase 4.2B.2, family 5 of 6: additive who-to-follow v2 (scoring contract v2 §5).
-- Same output shape and reason strings as v1 (drop-in cutover later); v1 routine and callers untouched.
-- Viewer-scoped: authenticated callers may only request their own viewer; service_role may request
-- any viewer. The project has no block/mute relation, so no such exclusion exists.

CREATE OR REPLACE FUNCTION public.get_who_to_follow_v2(p_user_id uuid, p_limit integer DEFAULT 5)
RETURNS TABLE(user_id uuid, username text, first_name text, last_name text, avatar_url text,
              reason text, source text, score double precision, mutuals integer,
              activity_count integer, profile_quality double precision)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2 §5: sources are discovery only; every feature is computed for every
-- candidate; reason priority frozen fof > active > fresh; tie-break score DESC, id ASC.
DECLARE
  v_limit integer;
BEGIN
  -- viewer-scoped authorization gate
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized for requested viewer';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 5), 50));

  RETURN QUERY
  WITH viewer_following AS (
    SELECT f.following_id FROM public.follows f WHERE f.follower_id = p_user_id
  ),
  src_fof AS (
    SELECT DISTINCT f2.following_id AS candidate_id
      FROM public.follows f2
     WHERE f2.follower_id IN (SELECT following_id FROM viewer_following)
  ),
  src_fresh AS (
    SELECT p.id AS candidate_id FROM public.profiles p
     WHERE p.created_at >= now() - interval '14 days'
  ),
  src_active AS (
    SELECT DISTINCT a.actor_id AS candidate_id FROM (
      SELECT p.user_id AS actor_id FROM public.posts p
       WHERE p.created_at >= now() - interval '7 days'
         AND p.status = 'published' AND p.is_deleted = false AND p.visibility = 'public'
      UNION ALL
      SELECT r.user_id FROM public.reviews r
       WHERE r.created_at >= now() - interval '7 days'
         AND r.status = 'published' AND r.visibility = 'public' AND r.entity_id IS NOT NULL
    ) a
  ),
  discovery AS (
    SELECT candidate_id, 'fof'::text AS src FROM src_fof
    UNION
    SELECT candidate_id, 'active'::text FROM src_active
    UNION
    SELECT candidate_id, 'fresh'::text FROM src_fresh
  ),
  pool AS (
    SELECT DISTINCT d.candidate_id
      FROM discovery d
      JOIN public.profiles pr ON pr.id = d.candidate_id
     WHERE d.candidate_id <> p_user_id
       AND pr.deleted_at IS NULL
       AND d.candidate_id NOT IN (SELECT following_id FROM viewer_following)
       AND NOT EXISTS (
         SELECT 1 FROM public.suggestion_impressions si
          WHERE si.viewer_id = p_user_id
            AND si.suggested_id = d.candidate_id
            AND si.seen_at >= now() - interval '7 days'
       )
  ),
  features AS (
    SELECT
      pl.candidate_id,
      pr.username, pr.first_name, pr.last_name, pr.avatar_url,
      (SELECT COUNT(*)::integer FROM public.follows f
        WHERE f.following_id = pl.candidate_id
          AND f.follower_id IN (SELECT following_id FROM viewer_following)) AS mutual_count,
      (
        (SELECT COUNT(*)::integer FROM public.posts p
          WHERE p.user_id = pl.candidate_id
            AND p.created_at >= now() - interval '7 days'
            AND p.status = 'published' AND p.is_deleted = false AND p.visibility = 'public')
        +
        -- canonicalize over ALL public published reviews first, then apply the 7-day window:
        -- an older duplicate inside the window never counts if the true canonical row is older
        (SELECT COUNT(*)::integer FROM (
           SELECT DISTINCT ON (r.entity_id) r.id, r.created_at
             FROM public.reviews r
            WHERE r.user_id = pl.candidate_id AND r.entity_id IS NOT NULL
              AND r.status = 'published' AND r.visibility = 'public'
            ORDER BY r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
         ) cr WHERE cr.created_at >= now() - interval '7 days')
      ) AS activity_7d,
      ((CASE WHEN pr.username IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN pr.avatar_url IS NOT NULL THEN 1 ELSE 0 END)::double precision / 2.0) AS quality
      FROM pool pl
      JOIN public.profiles pr ON pr.id = pl.candidate_id
  ),
  normalized AS (
    SELECT f.*,
      (SELECT MAX(f2.mutual_count) FROM features f2) AS max_mutuals,
      -- reason priority: fof > active > fresh, resolved per candidate from discovery membership
      (CASE WHEN f.candidate_id IN (SELECT candidate_id FROM src_fof) THEN 'fof'
            WHEN f.candidate_id IN (SELECT candidate_id FROM src_active) THEN 'active'
            ELSE 'fresh' END)::text AS source_type
      FROM features f
  ),
  scored AS (
    SELECT n.*,
      (0.6 * (n.mutual_count::double precision / GREATEST(1, n.max_mutuals))
     + 0.3 * (LEAST(n.activity_7d, 10)::double precision / 10.0)
     + 0.1 * n.quality)::double precision AS calculated_score,
      CASE
        WHEN n.source_type = 'fof' THEN
          CASE WHEN n.mutual_count > 1 THEN 'Followed by ' || n.mutual_count || ' people you follow'
               ELSE 'Followed by someone you follow' END
        WHEN n.source_type = 'active' THEN
          'Popular this week'
        WHEN n.source_type = 'fresh' THEN
          'New on Common Groundz'
        ELSE 'Suggested for you'
      END AS reason_text
      FROM normalized n
  )
  SELECT
    s.candidate_id AS user_id,
    s.username,
    s.first_name,
    s.last_name,
    s.avatar_url,
    s.reason_text AS reason,
    s.source_type AS source,
    s.calculated_score AS score,
    s.mutual_count AS mutuals,
    s.activity_7d AS activity_count,
    s.quality AS profile_quality
    FROM scored s
   ORDER BY s.calculated_score DESC, s.candidate_id ASC
   LIMIT v_limit;
END;
$fn$;

ALTER FUNCTION public.get_who_to_follow_v2(uuid, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_who_to_follow_v2(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_who_to_follow_v2(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_who_to_follow_v2(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_who_to_follow_v2(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_who_to_follow_v2(uuid, integer) TO service_role;