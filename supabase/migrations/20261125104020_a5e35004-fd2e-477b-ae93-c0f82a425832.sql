-- Phase 10.1: one approved dummy conversion and public-only viewer endorsements.
-- Private's persisted enum label is 'private'; no enum/constraint/UI changes here.
DO $migration$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_count integer;
BEGIN
  SELECT to_jsonb(r) INTO STRICT v_before
  FROM public.reviews r
  WHERE r.id = 'b03b4226-b59f-43c4-a8ec-56d64a858a41'::uuid
  FOR UPDATE;

  IF v_before->>'user_id' IS DISTINCT FROM 'c8508bd3-35a9-4cce-a7c8-0b5fc2bca965'
     OR v_before->>'entity_id' IS DISTINCT FROM 'ddd6416d-aade-48fe-a3b8-2370e4ef9843'
     OR v_before->>'visibility' IS DISTINCT FROM 'circle_only'
     OR v_before->>'status' IS DISTINCT FROM 'published'
     OR md5((v_before - 'visibility' - 'updated_at')::text) IS DISTINCT FROM '7bf920d0cb75ffce4b719892e35e7620' THEN
    RAISE EXCEPTION 'Approved dummy review changed since audit; aborting conversion';
  END IF;

  UPDATE public.reviews SET visibility = 'public'::public.recommendation_visibility
  WHERE id = 'b03b4226-b59f-43c4-a8ec-56d64a858a41'::uuid
    AND visibility = 'circle_only'::public.recommendation_visibility;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected exactly one dummy conversion'; END IF;

  SELECT to_jsonb(r) INTO STRICT v_after FROM public.reviews r
  WHERE r.id = 'b03b4226-b59f-43c4-a8ec-56d64a858a41'::uuid;
  IF v_after->>'visibility' IS DISTINCT FROM 'public'
     OR (v_after - 'visibility' - 'updated_at') IS DISTINCT FROM (v_before - 'visibility' - 'updated_at') THEN
    RAISE EXCEPTION 'Review preservation assertion failed';
  END IF;
END;
$migration$;

-- This RPC also serves extended/community discovery: caller p_user_ids retains
-- its existing scope. Circle callers supply followed authors, never mutuals.
CREATE OR REPLACE FUNCTION public.get_canonical_endorsements_for_viewer(
  p_viewer_id uuid,
  p_user_ids uuid[] DEFAULT NULL,
  p_entity_ids uuid[] DEFAULT NULL,
  p_since timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (user_id uuid, entity_id uuid, effective_rating numeric, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
BEGIN
  IF p_viewer_id IS NULL THEN RAISE EXCEPTION 'viewer id is required'; END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_viewer_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH canonical AS (
    SELECT DISTINCT ON (r.user_id, r.entity_id)
      r.user_id, r.entity_id, r.is_recommended,
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
$function$;
-- CREATE OR REPLACE retains the existing postgres owner and EXECUTE ACL.
-- No SELECT/write policies, working Circle-rating routines or constraints change.