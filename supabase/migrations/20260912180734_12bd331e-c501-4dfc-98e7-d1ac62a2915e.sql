-- Phase 4.2B.2, family 4 of 6: additive reputation v2 (scoring contract v2 §4).
-- No storage changes: result is computed on read. v1 routine and user_reputation rows untouched.

CREATE OR REPLACE FUNCTION public.calculate_user_reputation_v2(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
-- scoring contract v2 §4: 100 + 5 * eligible_contributions + 3 * helpful_flags_count, clamp [0, 1000].
-- Eligible contributions (fixtures rep-eligibility-predicates, rep-canonical-one-review-per-item):
--   reviews:  entity_id IS NOT NULL, status='published' AND visibility='public',
--             canonical first (one per reviewed item; unlinked legacy reviews never count)
--   posts:    status='published' AND is_deleted=false AND visibility='public'
--             (global signal: private/Circle-only posts must not lift it — same public-only rule as §0)
--   entities: created_by=user AND is_deleted=false
-- Rating values are never read: negative reviews count exactly like positive ones
-- (fixture rep-negative-reviews-count-equally).
DECLARE
  v_reviews integer;
  v_posts integer;
  v_entities integer;
  v_flags integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_reviews
    FROM (
      SELECT DISTINCT ON (r.entity_id) r.id
        FROM public.reviews r
       WHERE r.user_id = p_user_id
         AND r.entity_id IS NOT NULL
         AND r.status = 'published' AND r.visibility = 'public'
       ORDER BY r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
    ) canon_reviews;

  SELECT COUNT(*)::integer INTO v_posts
    FROM public.posts p
   WHERE p.user_id = p_user_id
     AND p.status = 'published' AND p.is_deleted = false
     AND p.visibility = 'public';

  SELECT COUNT(*)::integer INTO v_entities
    FROM public.entities e
   WHERE e.created_by = p_user_id AND e.is_deleted = false;

  SELECT COALESCE(ur.helpful_flags_count, 0)::integer INTO v_flags
    FROM public.user_reputation ur
   WHERE ur.user_id = p_user_id;

  RETURN GREATEST(0, LEAST(
    100 + 5 * (COALESCE(v_reviews, 0) + COALESCE(v_posts, 0) + COALESCE(v_entities, 0))
      + 3 * COALESCE(v_flags, 0),
    1000));
END;
$fn$;

ALTER FUNCTION public.calculate_user_reputation_v2(uuid) OWNER TO postgres;
-- Conservative per frozen rule: reputation is internal-only pending a public-input audit.
REVOKE ALL ON FUNCTION public.calculate_user_reputation_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_user_reputation_v2(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.calculate_user_reputation_v2(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_reputation_v2(uuid) TO service_role;