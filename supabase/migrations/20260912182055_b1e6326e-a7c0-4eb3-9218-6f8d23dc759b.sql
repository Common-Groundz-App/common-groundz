-- Phase 4.2B.2, family 6 of 6: additive personalised items v2 (scoring contract v2 §6).
-- Same output shape and reason strings as v1 (drop-in cutover later); v1 routine and callers untouched.
-- user_interests.entity_type is text (verified) while entities.type is the canonical enum,
-- so the join compares enum::text to text.

CREATE OR REPLACE FUNCTION public.get_personalized_entities_v2(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(entity_id uuid, personalization_score double precision, reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2 §6: every term null-safe and two-sided clamped to [0,1] before weighting
-- (0.5 interest / 0.3 follow activity / 0.2 trending); trending reads the v2 column;
-- tie-break score DESC, trending_n DESC, id ASC; sparse users get trending-only ranking.
DECLARE
  v_limit integer;
BEGIN
  -- viewer-scoped authorization gate (same rule as get_who_to_follow_v2)
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized for requested viewer';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));

  RETURN QUERY
  WITH viewer_following AS (
    SELECT f.following_id FROM public.follows f WHERE f.follower_id = p_user_id
  ),
  pool AS (
    SELECT e.id, e.type, COALESCE(e.trending_score_v2, 0) AS trending_raw
      FROM public.entities e
     WHERE e.is_deleted = false
       -- "already reviewed" = ANY existing review record for (viewer, item), drafts included:
       -- an in-progress review means the item is already on the viewer's radar
       AND NOT EXISTS (
         SELECT 1 FROM public.reviews r
          WHERE r.entity_id = e.id AND r.user_id = p_user_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.entity_saves s
          WHERE s.entity_id = e.id AND s.user_id = p_user_id
       )
  ),
  interests AS (
    SELECT ui.entity_type, MAX(ui.interest_score)::double precision AS interest_score
      FROM public.user_interests ui
     WHERE ui.user_id = p_user_id
     GROUP BY ui.entity_type
  ),
  -- canonicalize each followed author's reviews of each item FIRST (over all their public or
  -- Circle reviews), then apply the 30-day window; Circle = people the viewer follows
  -- (fixture pers-circle-review-counts-for-viewer); private reviews never count.
  social AS (
    SELECT c.entity_id, COUNT(DISTINCT c.user_id)::double precision AS followed_reviewers
      FROM (
        SELECT DISTINCT ON (r.user_id, r.entity_id) r.user_id, r.entity_id, r.created_at
          FROM public.reviews r
         WHERE r.user_id IN (SELECT following_id FROM viewer_following)
           AND r.entity_id IS NOT NULL
           AND r.status = 'published'
           AND r.visibility IN ('public', 'circle_only')
         ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
      ) c
     WHERE c.created_at >= now() - interval '30 days'
     GROUP BY c.entity_id
  ),
  scored AS (
    SELECT
      p.id,
      GREATEST(0, LEAST(COALESCE(i.interest_score, 0), 5)) / 5.0 AS interest_n,
      GREATEST(0, LEAST(COALESCE(s.followed_reviewers, 0), 5)) / 5.0 AS social_n,
      GREATEST(0, LEAST(p.trending_raw, 1.2)) / 1.2 AS trending_n
      FROM pool p
      LEFT JOIN interests i ON i.entity_type = p.type::text
      LEFT JOIN social s ON s.entity_id = p.id
  )
  SELECT
    sc.id AS entity_id,
    GREATEST(0, LEAST(0.5 * sc.interest_n + 0.3 * sc.social_n + 0.2 * sc.trending_n, 1)) AS personalization_score,
    CASE
      WHEN sc.interest_n > 0 THEN 'Based on your interests'
      WHEN sc.social_n > 0 THEN 'Popular with people you follow'
      ELSE 'Trending now'
    END AS reason
    FROM scored sc
   ORDER BY personalization_score DESC, sc.trending_n DESC, sc.id ASC
   LIMIT v_limit;
END;
$fn$;

ALTER FUNCTION public.get_personalized_entities_v2(uuid, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_personalized_entities_v2(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_personalized_entities_v2(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_personalized_entities_v2(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_personalized_entities_v2(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_personalized_entities_v2(uuid, integer) TO service_role;