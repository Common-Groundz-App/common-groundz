-- Phase 4.2B.2, family 1 of 6: additive trending v2 (scoring contract v2).
-- v1 trending_score, its routines and its writers are untouched. No consumer reads v2 yet.

ALTER TABLE public.entities
  ADD COLUMN trending_score_v2 double precision NOT NULL DEFAULT 0;

ALTER TABLE public.entities
  ADD CONSTRAINT entities_trending_score_v2_range
  CHECK (trending_score_v2 >= 0 AND trending_score_v2 <= 1.2);

-- Pure scorer: returns the v2 score for one entity, writes nothing.
CREATE OR REPLACE FUNCTION public.calculate_entity_trending_score_v2(p_entity_id uuid)
RETURNS double precision
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2: canonical reviews, normalised components, capped inputs, [0, 1.2] output
-- views: entity_views is a mixed interaction table (audited live values: 'click' only; the writer
-- allows view|click|like|save). Frozen: view/click/NULL count as entity attention; like/save do
-- not, because engagement is already its own weighted term.
-- timeline updates: review_updates has no update/event type column (audited); a row qualifies only
-- when it carries a rating, recommendation intent, comment or media change.
DECLARE
  v_window timestamptz := now() - interval '24 hours';
  v_ident_views integer;
  v_anon_views integer;
  v_views integer;
  v_engagement integer;
  v_contributions integer;
  v_views_n double precision;
  v_engagement_n double precision;
  v_contributions_n double precision;
  v_velocity double precision;
  v_base_pop double precision;
  v_geo double precision;
  v_seasonal double precision;
  v_age_factor double precision;
  v_created_at timestamptz;
  v_popularity double precision;
  v_geo_raw double precision;
  v_seasonal_raw double precision;
BEGIN
  SELECT e.created_at, e.popularity_score, e.geographic_boost, e.seasonal_boost
    INTO v_created_at, v_popularity, v_geo_raw, v_seasonal_raw
    FROM public.entities e
   WHERE e.id = p_entity_id AND e.is_deleted = false;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- views: identified viewers capped at 20 each per 24 h
  SELECT COALESCE(SUM(LEAST(cnt, 20)), 0)::integer
    INTO v_ident_views
    FROM (SELECT COUNT(*) AS cnt FROM public.entity_views
           WHERE entity_id = p_entity_id AND created_at >= v_window AND user_id IS NOT NULL
             AND COALESCE(interaction_type, 'view') IN ('view', 'click')
           GROUP BY user_id) s;

  -- anonymous views: one per session where a session is recorded, every row where it is not,
  -- then the aggregate anonymous cap.
  SELECT (COUNT(DISTINCT session_id) + COUNT(*) FILTER (WHERE session_id IS NULL))::integer
    INTO v_anon_views
    FROM public.entity_views
   WHERE entity_id = p_entity_id AND created_at >= v_window AND user_id IS NULL
     AND COALESCE(interaction_type, 'view') IN ('view', 'click');
  v_anon_views := LEAST(COALESCE(v_anon_views, 0), 2 * v_ident_views + 50);
  v_views := v_ident_views + v_anon_views;

  -- contributions: per person, at most 1 review-side + 1 entity-linked post, in window.
  WITH canon AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id) r.id, r.user_id
      FROM public.reviews r
     WHERE r.entity_id = p_entity_id AND r.status = 'published' AND r.visibility = 'public'
     ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  ), review_side AS (
    SELECT c.user_id
      FROM canon c
      JOIN public.reviews r ON r.id = c.id
     WHERE r.created_at >= v_window
    UNION
    SELECT c.user_id
      FROM canon c
     WHERE EXISTS (
       SELECT 1 FROM public.review_updates ru
        WHERE ru.review_id = c.id AND ru.created_at >= v_window
          AND (ru.rating IS NOT NULL
               OR ru.would_recommend IS NOT NULL
               OR (ru.comment IS NOT NULL AND btrim(ru.comment) <> '')
               OR (ru.media IS NOT NULL
                   AND ru.media::text NOT IN ('null', '[]', '{}', '')))
     )
  ), post_links AS (
    SELECT pe.post_id, pe.entity_id FROM public.post_entities pe
    UNION
    SELECT p.id AS post_id, p.entity_id FROM public.posts p WHERE p.entity_id IS NOT NULL
  ), post_side AS (
    SELECT p.user_id
      FROM public.posts p
      JOIN post_links pl ON pl.post_id = p.id AND pl.entity_id = p_entity_id
     WHERE p.is_deleted = false AND p.status = 'published' AND p.visibility = 'public'
       AND p.created_at >= v_window
     GROUP BY p.user_id
  ), people AS (
    SELECT user_id FROM review_side UNION SELECT user_id FROM post_side
  )
  SELECT COALESCE(SUM(
           (CASE WHEN rs.user_id IS NOT NULL THEN 1 ELSE 0 END) +
           (CASE WHEN ps.user_id IS NOT NULL THEN 1 ELSE 0 END)), 0)::integer
    INTO v_contributions
    FROM people ppl
    LEFT JOIN review_side rs ON rs.user_id = ppl.user_id
    LEFT JOIN post_side ps ON ps.user_id = ppl.user_id;

  -- engagement: distinct like events on this item's CANONICAL public published reviews and its
  -- entity-linked posts; self-likes excluded; capped 5 per actor per item per window.
  WITH canon AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id) r.id, r.user_id
      FROM public.reviews r
     WHERE r.entity_id = p_entity_id AND r.status = 'published' AND r.visibility = 'public'
     ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  ), post_links AS (
    SELECT pe.post_id, pe.entity_id FROM public.post_entities pe
    UNION
    SELECT p.id AS post_id, p.entity_id FROM public.posts p WHERE p.entity_id IS NOT NULL
  ), likes AS (
    SELECT rl.user_id AS actor
      FROM public.review_likes rl
      JOIN canon c ON c.id = rl.review_id
     WHERE rl.created_at >= v_window AND rl.user_id <> c.user_id
    UNION ALL
    SELECT pl2.user_id AS actor
      FROM public.post_likes pl2
      JOIN public.posts p ON p.id = pl2.post_id
      JOIN post_links pl ON pl.post_id = p.id AND pl.entity_id = p_entity_id
     WHERE p.is_deleted = false AND p.status = 'published' AND p.visibility = 'public'
       AND pl2.created_at >= v_window AND pl2.user_id <> p.user_id
  )
  SELECT COALESCE(SUM(LEAST(cnt, 5)), 0)::integer
    INTO v_engagement
    FROM (SELECT COUNT(*) AS cnt FROM likes GROUP BY actor) s;

  v_views_n := LEAST(v_views, 500) / 500.0;
  v_engagement_n := LEAST(v_engagement, 200) / 200.0;
  v_contributions_n := LEAST(v_contributions, 50) / 50.0;
  v_velocity := 0.5 * v_views_n + 0.3 * v_engagement_n + 0.2 * v_contributions_n;

  v_base_pop := GREATEST(0, LEAST(COALESCE(v_popularity, 0), 1000)) / 1000.0;
  v_geo := GREATEST(0, LEAST(COALESCE(v_geo_raw, 0), 1));
  v_seasonal := GREATEST(0, LEAST(COALESCE(v_seasonal_raw, 0), 1));
  v_age_factor := CASE
    WHEN v_created_at >= now() - interval '7 days' THEN 1.2
    WHEN v_created_at >= now() - interval '30 days' THEN 1.1
    ELSE 1.0 END;

  RETURN GREATEST(0, LEAST(
    (0.3 * v_base_pop + 0.4 * v_velocity + 0.15 * v_geo + 0.15 * v_seasonal) * v_age_factor,
    1.2));
END;
$fn$;

ALTER FUNCTION public.calculate_entity_trending_score_v2(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.calculate_entity_trending_score_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_entity_trending_score_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_entity_trending_score_v2(uuid) TO service_role;

-- Candidate selector: eligible activity in 24 h, union entities whose stored v2 score is non-zero.
-- Eligibility predicates mirror the scorer, so ineligible activity causes no needless recompute.
CREATE OR REPLACE FUNCTION public.select_trending_candidates_v2()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2: eligible activity window union non-zero stored score
BEGIN
  -- service_role only, decided from the request JWT role, never current_user
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only';
  END IF;

  RETURN QUERY
  WITH post_links AS (
    SELECT pe.post_id, pe.entity_id FROM public.post_entities pe
    UNION
    SELECT p.id AS post_id, p.entity_id FROM public.posts p WHERE p.entity_id IS NOT NULL
  ), pub_reviews AS (
    SELECT r.id, r.entity_id, r.created_at
      FROM public.reviews r
     WHERE r.status = 'published' AND r.visibility = 'public' AND r.entity_id IS NOT NULL
  ), pub_posts AS (
    SELECT p.id, p.created_at
      FROM public.posts p
     WHERE p.is_deleted = false AND p.status = 'published' AND p.visibility = 'public'
  ), active AS (
    SELECT ev.entity_id FROM public.entity_views ev
     WHERE ev.created_at >= now() - interval '24 hours'
       AND COALESCE(ev.interaction_type, 'view') IN ('view', 'click')
    UNION
    SELECT pr.entity_id FROM pub_reviews pr
     WHERE pr.created_at >= now() - interval '24 hours'
    UNION
    SELECT pr.entity_id FROM public.review_updates ru
      JOIN pub_reviews pr ON pr.id = ru.review_id
     WHERE ru.created_at >= now() - interval '24 hours'
       AND (ru.rating IS NOT NULL
            OR ru.would_recommend IS NOT NULL
            OR (ru.comment IS NOT NULL AND btrim(ru.comment) <> '')
            OR (ru.media IS NOT NULL AND ru.media::text NOT IN ('null', '[]', '{}', '')))
    UNION
    SELECT pl.entity_id FROM pub_posts pp
      JOIN post_links pl ON pl.post_id = pp.id
     WHERE pp.created_at >= now() - interval '24 hours'
    UNION
    SELECT pr.entity_id FROM public.review_likes rl
      JOIN pub_reviews pr ON pr.id = rl.review_id
     WHERE rl.created_at >= now() - interval '24 hours'
    UNION
    SELECT pl.entity_id FROM public.post_likes pk
      JOIN pub_posts pp ON pp.id = pk.post_id
      JOIN post_links pl ON pl.post_id = pp.id
     WHERE pk.created_at >= now() - interval '24 hours'
  )
  SELECT DISTINCT a.entity_id FROM active a
    JOIN public.entities e ON e.id = a.entity_id AND e.is_deleted = false
  UNION
  SELECT e.id FROM public.entities e
   WHERE e.is_deleted = false AND e.trending_score_v2 <> 0;
END;
$fn$;

ALTER FUNCTION public.select_trending_candidates_v2() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.select_trending_candidates_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_trending_candidates_v2() TO service_role;

-- Updater: recomputes candidates (or, when p_bootstrap, every non-deleted entity once).
CREATE OR REPLACE FUNCTION public.update_all_trending_scores_v2(p_bootstrap boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2: bootstrap covers all non-deleted entities; steady state uses candidates
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  -- service_role only, decided from the request JWT role, never current_user
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only';
  END IF;

  FOR v_id IN
    SELECT e.id FROM public.entities e WHERE e.is_deleted = false AND p_bootstrap
    UNION
    SELECT c FROM public.select_trending_candidates_v2() c WHERE NOT p_bootstrap
  LOOP
    UPDATE public.entities
       SET trending_score_v2 = public.calculate_entity_trending_score_v2(v_id)
     WHERE id = v_id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$fn$;

ALTER FUNCTION public.update_all_trending_scores_v2(boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_all_trending_scores_v2(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_all_trending_scores_v2(boolean) TO service_role;