-- Phase 4.2B.3 — canonical-first endorsement reads.
-- Canonical selection (one current review per person per item) happens BEFORE the
-- endorsement flag is inspected and before any row cap, so a stale "yes" can never
-- outlive a newer "no". Final ordering is fully deterministic: created_at DESC,
-- then entity id, then person id.

CREATE OR REPLACE FUNCTION public.get_canonical_endorsements_public(
  p_user_ids uuid[] DEFAULT NULL,
  p_entity_ids uuid[] DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  user_id uuid,
  entity_id uuid,
  effective_rating numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
BEGIN
  RETURN QUERY
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.user_id,
      r.entity_id,
      r.is_recommended,
      COALESCE(r.latest_rating, r.rating::numeric) AS effective_rating,
      r.created_at
    FROM public.reviews r
    WHERE r.entity_id IS NOT NULL
      AND r.status = 'published'
      AND r.visibility = 'public'::recommendation_visibility
      AND (p_user_ids IS NULL OR r.user_id = ANY (p_user_ids))
      AND (p_entity_ids IS NULL OR r.entity_id = ANY (p_entity_ids))
      AND (p_since IS NULL OR r.created_at >= p_since)
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  )
  SELECT c.user_id, c.entity_id, c.effective_rating, c.created_at
  FROM canonical c
  WHERE c.is_recommended IS TRUE
  ORDER BY c.created_at DESC NULLS LAST, c.entity_id, c.user_id
  LIMIT v_limit;
END;
$$;

ALTER FUNCTION public.get_canonical_endorsements_public(uuid[], uuid[], timestamptz, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_canonical_endorsements_public(uuid[], uuid[], timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_canonical_endorsements_public(uuid[], uuid[], timestamptz, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_canonical_endorsements_public(uuid[], uuid[], timestamptz, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_canonical_endorsements_public(uuid[], uuid[], timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_canonical_endorsements_public(uuid[], uuid[], timestamptz, integer) TO service_role;

-- Viewer-scoped variant: public + the viewer's own + circle_only reviews written by
-- authors the viewer follows. Identity is enforced server-side.
-- The viewer's own rows are available for own-data/seed logic only; social-proof
-- callers must not count them as another person's endorsement.
CREATE OR REPLACE FUNCTION public.get_canonical_endorsements_for_viewer(
  p_viewer_id uuid,
  p_user_ids uuid[] DEFAULT NULL,
  p_entity_ids uuid[] DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  user_id uuid,
  entity_id uuid,
  effective_rating numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
BEGIN
  IF p_viewer_id IS NULL THEN
    RAISE EXCEPTION 'viewer id is required';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_viewer_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.user_id,
      r.entity_id,
      r.is_recommended,
      COALESCE(r.latest_rating, r.rating::numeric) AS effective_rating,
      r.created_at
    FROM public.reviews r
    WHERE r.entity_id IS NOT NULL
      AND r.status = 'published'
      AND (
        r.visibility = 'public'::recommendation_visibility
        OR r.user_id = p_viewer_id
        OR (
          r.visibility = 'circle_only'::recommendation_visibility
          AND EXISTS (
            SELECT 1 FROM public.follows f
            WHERE f.follower_id = p_viewer_id
              AND f.following_id = r.user_id
          )
        )
      )
      AND (p_user_ids IS NULL OR r.user_id = ANY (p_user_ids))
      AND (p_entity_ids IS NULL OR r.entity_id = ANY (p_entity_ids))
      AND (p_since IS NULL OR r.created_at >= p_since)
    ORDER BY r.user_id, r.entity_id, r.created_at DESC NULLS LAST, r.id DESC
  )
  SELECT c.user_id, c.entity_id, c.effective_rating, c.created_at
  FROM canonical c
  WHERE c.is_recommended IS TRUE
  ORDER BY c.created_at DESC NULLS LAST, c.entity_id, c.user_id
  LIMIT v_limit;
END;
$$;

ALTER FUNCTION public.get_canonical_endorsements_for_viewer(uuid, uuid[], uuid[], timestamptz, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_canonical_endorsements_for_viewer(uuid, uuid[], uuid[], timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_canonical_endorsements_for_viewer(uuid, uuid[], uuid[], timestamptz, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_canonical_endorsements_for_viewer(uuid, uuid[], uuid[], timestamptz, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_canonical_endorsements_for_viewer(uuid, uuid[], uuid[], timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_canonical_endorsements_for_viewer(uuid, uuid[], uuid[], timestamptz, integer) TO service_role;