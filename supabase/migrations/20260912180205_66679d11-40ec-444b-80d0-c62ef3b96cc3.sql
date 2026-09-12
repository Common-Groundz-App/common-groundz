-- Phase 4.2B.2, family 3 of 6: additive similarity v2 (scoring contract v2 §7).
-- No storage: result is computed on read. v1 routine and callers untouched.

CREATE OR REPLACE FUNCTION public.calculate_user_similarity_v2(p_user_a uuid, p_user_b uuid)
RETURNS double precision
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2 §7:
--   1. canonicalize: current canonical PUBLIC published review per (user, entity)
--   2. effective rating: latest timeline rating, otherwise original rating
--   3. then exclude rows whose EFFECTIVE rating is NULL
--   (an older review must never become canonical just because the true canonical row
--    has a NULL original rating — same invariant as the trending family)
--   Pearson mapped to [0,1]; <3 shared -> NULL; zero-variance fallback 1 - mean(|a-b|)/4;
--   confidence discount shared/5 when 3-4 shared.
DECLARE
  v_shared integer;
  v_r double precision;
  v_mad double precision;
  v_adjusted double precision;
  v_confidence double precision;
BEGIN
  IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
    RETURN NULL;
  END IF;

  WITH canon AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id) r.user_id, r.entity_id, r.id, r.rating
      FROM public.reviews r
     WHERE r.user_id IN (p_user_a, p_user_b)
       AND r.status = 'published' AND r.visibility = 'public'
     ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  ), eff AS (
    SELECT c.user_id, c.entity_id,
           COALESCE((
             SELECT ru.rating FROM public.review_updates ru
              WHERE ru.review_id = c.id AND ru.rating IS NOT NULL
              ORDER BY ru.created_at DESC NULLS LAST, ru.id DESC
              LIMIT 1
           ), c.rating)::double precision AS rating
      FROM canon c
  ), usable AS (
    SELECT user_id, entity_id, rating FROM eff WHERE rating IS NOT NULL
  ), shared AS (
    SELECT a.entity_id, a.rating AS ra, b.rating AS rb
      FROM usable a
      JOIN usable b ON b.entity_id = a.entity_id AND b.user_id = p_user_b
     WHERE a.user_id = p_user_a
  ), stats AS (
    SELECT COUNT(*)::integer AS n,
           AVG(ra) AS ma, AVG(rb) AS mb,
           AVG(ABS(ra - rb)) AS mad
      FROM shared
  ), pearson AS (
    SELECT CASE
             WHEN st.n >= 3
                  AND SUM(POWER(s.ra - st.ma, 2)) > 0
                  AND SUM(POWER(s.rb - st.mb, 2)) > 0
             THEN SUM((s.ra - st.ma) * (s.rb - st.mb))
                  / (SQRT(SUM(POWER(s.ra - st.ma, 2))) * SQRT(SUM(POWER(s.rb - st.mb, 2))))
             ELSE NULL
           END AS r
      FROM shared s CROSS JOIN stats st
     GROUP BY st.n, st.ma, st.mb
  )
  SELECT st.n, p.r, st.mad
    INTO v_shared, v_r, v_mad
    FROM stats st CROSS JOIN pearson p;

  IF v_shared IS NULL OR v_shared < 3 THEN
    RETURN NULL;
  END IF;

  v_adjusted := CASE WHEN v_r IS NOT NULL THEN (v_r + 1) / 2.0
                     ELSE GREATEST(0, 1 - COALESCE(v_mad, 0) / 4.0) END;
  v_confidence := CASE WHEN v_shared >= 5 THEN 1.0 ELSE v_shared / 5.0 END;

  RETURN GREATEST(0, LEAST(v_adjusted * v_confidence, 1));
END;
$fn$;

ALTER FUNCTION public.calculate_user_similarity_v2(uuid, uuid) OWNER TO postgres;
-- Explicit surface (do not rely on project default function grants): reads public data only,
-- mirrors the proven v1 caller surface.
REVOKE ALL ON FUNCTION public.calculate_user_similarity_v2(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_user_similarity_v2(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.calculate_user_similarity_v2(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_similarity_v2(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.calculate_user_similarity_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_similarity_v2(uuid, uuid) TO service_role;