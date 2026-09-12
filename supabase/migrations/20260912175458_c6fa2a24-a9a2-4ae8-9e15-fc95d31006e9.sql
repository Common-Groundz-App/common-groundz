-- Phase 4.2B.2, family 2 of 6: additive influence v2 (scoring contract v2).
-- v1 social_influence_scores, its routines and writers are untouched. No consumer reads v2 yet.

CREATE TABLE public.social_influence_scores_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  canonical_type public.entity_type NOT NULL,
  influence_score double precision NOT NULL DEFAULT 0
    CONSTRAINT social_influence_scores_v2_score_range CHECK (influence_score >= 0 AND influence_score <= 1),
  follower_count integer NOT NULL DEFAULT 0,
  contribution_count integer NOT NULL DEFAULT 0,
  engagement_avg double precision NOT NULL DEFAULT 0,
  last_calculated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_influence_scores_v2_user_type_key UNIQUE (user_id, canonical_type)
);
-- note: no separate user_id index — the UNIQUE (user_id, canonical_type) btree already leads on user_id

GRANT SELECT ON public.social_influence_scores_v2 TO authenticated;
GRANT ALL ON public.social_influence_scores_v2 TO service_role;

ALTER TABLE public.social_influence_scores_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read social influence scores v2"
  ON public.social_influence_scores_v2 FOR SELECT TO authenticated USING (true);

-- Components helper: one definition of the credited set, shared by the calculator and the refresh.
-- scoring contract v2 §3: credited set = one canonical published public review per (author, entity)
-- of this type, plus the earliest eligible public entity-linked post per (author, entity) of this
-- type. Engagement is LIFETIME non-self likes on that exact set: no 24h window and no per-actor cap
-- (those belong to trending only). Multi-entity engagement is content-deduped: likes on one post
-- count once per type, never once per credited (post, entity) row.
CREATE OR REPLACE FUNCTION public.calculate_social_influence_components_v2(
  p_user_id uuid,
  p_canonical_type public.entity_type
)
RETURNS TABLE(follower_count integer, contribution_count integer, total_likes integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN QUERY
  WITH canon_reviews AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id) r.id
      FROM public.reviews r
      JOIN public.entities e ON e.id = r.entity_id
     WHERE r.user_id = p_user_id
       AND r.status = 'published' AND r.visibility = 'public'
       AND e.is_deleted = false AND e.type = p_canonical_type
     ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  ), post_links AS (
    SELECT pe.post_id, pe.entity_id FROM public.post_entities pe
    UNION
    SELECT p.id AS post_id, p.entity_id FROM public.posts p WHERE p.entity_id IS NOT NULL
  ), credited_posts AS (
    SELECT DISTINCT ON (p.user_id, pl.entity_id) pl.entity_id, p.id AS post_id
      FROM public.posts p
      JOIN post_links pl ON pl.post_id = p.id
      JOIN public.entities e ON e.id = pl.entity_id
     WHERE p.user_id = p_user_id
       AND p.is_deleted = false AND p.status = 'published' AND p.visibility = 'public'
       AND e.is_deleted = false AND e.type = p_canonical_type
     ORDER BY p.user_id, pl.entity_id, p.created_at ASC, p.id ASC
  )
  SELECT
    (SELECT COUNT(*)::integer FROM public.follows f WHERE f.following_id = p_user_id),
    ((SELECT COUNT(*) FROM canon_reviews) + (SELECT COUNT(*) FROM credited_posts))::integer,
    ((SELECT COUNT(*) FROM public.review_likes rl
       WHERE rl.review_id IN (SELECT id FROM canon_reviews) AND rl.user_id <> p_user_id)
   + (SELECT COUNT(*) FROM public.post_likes pl2
       WHERE pl2.post_id IN (SELECT DISTINCT post_id FROM credited_posts)
         AND pl2.user_id <> p_user_id))::integer;
END;
$fn$;

ALTER FUNCTION public.calculate_social_influence_components_v2(uuid, public.entity_type) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.calculate_social_influence_components_v2(uuid, public.entity_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_social_influence_components_v2(uuid, public.entity_type) FROM anon;
REVOKE ALL ON FUNCTION public.calculate_social_influence_components_v2(uuid, public.entity_type) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_social_influence_components_v2(uuid, public.entity_type) TO service_role;

-- Pure calculator: returns the v2 score, writes nothing.
CREATE OR REPLACE FUNCTION public.calculate_social_influence_score_v2(
  p_user_id uuid,
  p_canonical_type public.entity_type
)
RETURNS double precision
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2 §3: reach 0.35 / volume 0.35 / engagement 0.30, clamped [0, 1].
-- No term reads any rating value.
DECLARE
  v_followers integer;
  v_contributions integer;
  v_likes integer;
  v_engagement double precision;
BEGIN
  SELECT c.follower_count, c.contribution_count, c.total_likes
    INTO v_followers, v_contributions, v_likes
    FROM public.calculate_social_influence_components_v2(p_user_id, p_canonical_type) c;

  v_engagement := CASE WHEN COALESCE(v_contributions, 0) = 0 THEN 0
                       ELSE LEAST(v_likes::double precision / v_contributions, 50) / 50.0 END;

  RETURN GREATEST(0, LEAST(
      LEAST(COALESCE(v_followers, 0), 1000) / 1000.0 * 0.35
    + LEAST(COALESCE(v_contributions, 0), 100) / 100.0 * 0.35
    + v_engagement * 0.30,
    1));
END;
$fn$;

ALTER FUNCTION public.calculate_social_influence_score_v2(uuid, public.entity_type) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.calculate_social_influence_score_v2(uuid, public.entity_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_social_influence_score_v2(uuid, public.entity_type) FROM anon;
REVOKE ALL ON FUNCTION public.calculate_social_influence_score_v2(uuid, public.entity_type) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_social_influence_score_v2(uuid, public.entity_type) TO service_role;

-- Refresh orchestrator: candidate population = people with current eligible contributions UNION
-- people who already hold a v2 row, so someone who loses their last eligible contribution is still
-- refreshed and their stale rows are removed. Per person: compute the current eligible type set,
-- upsert each, then delete that person's v2 rows outside it. Deletes touch ONLY the new v2 table.
CREATE OR REPLACE FUNCTION public.refresh_social_influence_scores_v2()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2 §3 + reconciliation rule
DECLARE
  v_user uuid;
  v_type public.entity_type;
  v_types public.entity_type[];
  v_written integer := 0;
  v_followers integer;
  v_contributions integer;
  v_likes integer;
  v_score double precision;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only';
  END IF;

  FOR v_user IN
    WITH post_links AS (
      SELECT pe.post_id, pe.entity_id FROM public.post_entities pe
      UNION
      SELECT p.id AS post_id, p.entity_id FROM public.posts p WHERE p.entity_id IS NOT NULL
    ), review_authors AS (
      SELECT DISTINCT r.user_id
        FROM public.reviews r
        JOIN public.entities e ON e.id = r.entity_id
       WHERE r.status = 'published' AND r.visibility = 'public' AND e.is_deleted = false
    ), post_authors AS (
      SELECT DISTINCT p.user_id
        FROM public.posts p
        JOIN post_links pl ON pl.post_id = p.id
        JOIN public.entities e ON e.id = pl.entity_id
       WHERE p.is_deleted = false AND p.status = 'published' AND p.visibility = 'public'
         AND e.is_deleted = false
    )
    SELECT user_id FROM review_authors
    UNION SELECT user_id FROM post_authors
    UNION SELECT DISTINCT s.user_id FROM public.social_influence_scores_v2 s
  LOOP
    -- current eligible canonical types for this person
    WITH post_links AS (
      SELECT pe.post_id, pe.entity_id FROM public.post_entities pe
      UNION
      SELECT p.id AS post_id, p.entity_id FROM public.posts p WHERE p.entity_id IS NOT NULL
    ), review_types AS (
      SELECT DISTINCT e.type AS ctype
        FROM public.reviews r
        JOIN public.entities e ON e.id = r.entity_id
       WHERE r.user_id = v_user
         AND r.status = 'published' AND r.visibility = 'public' AND e.is_deleted = false
    ), post_types AS (
      SELECT DISTINCT e.type AS ctype
        FROM public.posts p
        JOIN post_links pl ON pl.post_id = p.id
        JOIN public.entities e ON e.id = pl.entity_id
       WHERE p.user_id = v_user
         AND p.is_deleted = false AND p.status = 'published' AND p.visibility = 'public'
         AND e.is_deleted = false
    )
    SELECT COALESCE(array_agg(ctype), ARRAY[]::public.entity_type[])
      INTO v_types
      FROM (SELECT ctype FROM review_types UNION SELECT ctype FROM post_types) cur;

    FOREACH v_type IN ARRAY v_types LOOP
      SELECT c.follower_count, c.contribution_count, c.total_likes
        INTO v_followers, v_contributions, v_likes
        FROM public.calculate_social_influence_components_v2(v_user, v_type) c;
      v_score := public.calculate_social_influence_score_v2(v_user, v_type);

      INSERT INTO public.social_influence_scores_v2
        (user_id, canonical_type, influence_score, follower_count, contribution_count,
         engagement_avg, last_calculated, updated_at)
      VALUES (
        v_user, v_type, v_score, v_followers, v_contributions,
        CASE WHEN COALESCE(v_contributions, 0) = 0 THEN 0
             ELSE v_likes::double precision / v_contributions END,
        now(), now())
      ON CONFLICT (user_id, canonical_type) DO UPDATE SET
        influence_score = EXCLUDED.influence_score,
        follower_count = EXCLUDED.follower_count,
        contribution_count = EXCLUDED.contribution_count,
        engagement_avg = EXCLUDED.engagement_avg,
        last_calculated = EXCLUDED.last_calculated,
        updated_at = now();
      v_written := v_written + 1;
    END LOOP;

    -- Reconciliation: drop this person's v2 rows whose type is no longer eligible.
    DELETE FROM public.social_influence_scores_v2 s
     WHERE s.user_id = v_user
       AND NOT (s.canonical_type = ANY (v_types));
  END LOOP;

  RETURN v_written;
END;
$fn$;

ALTER FUNCTION public.refresh_social_influence_scores_v2() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.refresh_social_influence_scores_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_social_influence_scores_v2() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_social_influence_scores_v2() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_social_influence_scores_v2() TO service_role;