-- ============================================================================
-- Phase 3C Stage 1 — recommendation & timeline database foundation
-- ============================================================================

-- 1. SCHEMA -------------------------------------------------------------------
ALTER TABLE public.review_updates
  ADD COLUMN IF NOT EXISTS would_recommend text NULL;

ALTER TABLE public.review_updates
  DROP CONSTRAINT IF EXISTS review_updates_would_recommend_check;

ALTER TABLE public.review_updates
  ADD CONSTRAINT review_updates_would_recommend_check
  CHECK (would_recommend IS NULL OR would_recommend IN ('yes','maybe','no','auto'));

CREATE INDEX IF NOT EXISTS review_updates_latest_intent_idx
  ON public.review_updates (review_id, created_at DESC, id DESC)
  WHERE would_recommend IS NOT NULL;

-- 2. AUTHORIZATION ------------------------------------------------------------
-- A policy only protects the table when RLS is actually enabled; assert it.
ALTER TABLE public.review_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own review updates" ON public.review_updates;
DROP POLICY IF EXISTS "Users can update their own review updates" ON public.review_updates;
DROP POLICY IF EXISTS "Users can delete their own review updates" ON public.review_updates;

CREATE POLICY "Owners can append updates to their own reviews"
  ON public.review_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_updates.review_id
        AND r.user_id = auth.uid()
    )
  );

-- Option A: strict RPC-only mutation surface. No client-facing role (including
-- service_role) holds direct UPDATE/DELETE; the SECURITY DEFINER RPCs run as the
-- postgres owner, which does.
REVOKE UPDATE, DELETE ON public.review_updates FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.review_updates FROM anon;
REVOKE UPDATE, DELETE ON public.review_updates FROM authenticated;
REVOKE UPDATE, DELETE ON public.review_updates FROM service_role;

GRANT SELECT ON public.review_updates TO anon;
GRANT SELECT, INSERT ON public.review_updates TO authenticated;
GRANT SELECT, INSERT ON public.review_updates TO service_role;

-- 3. SHARED LOCK KEY ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_timeline_lock_key(p_review_id uuid)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
  SELECT ('x' || substr(
    encode(extensions.digest(
      'review_timeline' || E'\x1f' || p_review_id::text, 'sha256'
    ), 'hex'), 1, 16))::bit(64)::bigint;
$$;

-- 4. PURE RESOLVER ------------------------------------------------------------
-- Frozen output contract:
--   intent:         'yes' | 'maybe' | 'no' | null
--   source:         'timeline_explicit' | 'review_explicit' | 'rating_inferred'
--   is_recommended: boolean
-- A latest 'auto' event discards all earlier explicit intent and resolves to
-- intent null / source rating_inferred; 'auto' is historical event data and never
-- becomes the resolved intent.
CREATE OR REPLACE FUNCTION public.resolve_review_recommendation(
  p_envelope jsonb,
  p_category text,
  p_latest_intent text,
  p_effective_rating numeric
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_envelope_intent text := NULL;
  v_answers jsonb;
  v_candidate text;
BEGIN
  -- Strict envelope extraction: object, version = 1, type matches the review's
  -- canonical category, answers object, would_recommend exactly yes/maybe/no.
  -- Anything malformed is treated as absent, never as false.
  IF p_envelope IS NOT NULL
     AND jsonb_typeof(p_envelope) = 'object'
     AND (p_envelope->>'version') = '1'
     AND p_envelope->>'type' IS NOT NULL
     AND p_envelope->>'type' = p_category
     AND jsonb_typeof(p_envelope->'answers') = 'object'
  THEN
    v_answers := p_envelope->'answers';
    v_candidate := v_answers->>'would_recommend';
    IF v_candidate IN ('yes','maybe','no') THEN
      v_envelope_intent := v_candidate;
    END IF;
  END IF;

  -- 1. Latest explicit timeline intent wins.
  IF p_latest_intent IN ('yes','maybe','no') THEN
    RETURN jsonb_build_object(
      'intent', p_latest_intent,
      'source', 'timeline_explicit',
      'is_recommended', p_latest_intent = 'yes'
    );
  END IF;

  -- 1b. Latest 'auto' discards earlier explicit intent and falls back to rating.
  IF p_latest_intent = 'auto' THEN
    RETURN jsonb_build_object(
      'intent', NULL,
      'source', 'rating_inferred',
      'is_recommended', COALESCE(p_effective_rating, 0) >= 4
    );
  END IF;

  -- 2. The review's own envelope answer.
  IF v_envelope_intent IS NOT NULL THEN
    RETURN jsonb_build_object(
      'intent', v_envelope_intent,
      'source', 'review_explicit',
      'is_recommended', v_envelope_intent = 'yes'
    );
  END IF;

  -- 3. Rating fallback.
  RETURN jsonb_build_object(
    'intent', NULL,
    'source', 'rating_inferred',
    'is_recommended', COALESCE(p_effective_rating, 0) >= 4
  );
END;
$$;

-- 5. REVIEW-AWARE WRAPPER -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_latest_recommendation_intent(p_review_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT u.would_recommend
  FROM public.review_updates u
  WHERE u.review_id = p_review_id
    AND u.would_recommend IS NOT NULL
  ORDER BY u.created_at DESC, u.id DESC
  LIMIT 1;
$$;

-- 6. CONSOLIDATED RECOMMENDATION TRIGGER ON reviews ---------------------------
CREATE OR REPLACE FUNCTION public.reviews_apply_recommendation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_intent   text;
  v_decision jsonb;
BEGIN
  v_intent := public.lookup_latest_recommendation_intent(NEW.id);

  v_decision := public.resolve_review_recommendation(
    NEW.metadata->'questionnaire',
    NEW.category,
    v_intent,
    COALESCE(NEW.latest_rating, NEW.rating)
  );

  NEW.is_recommended := (v_decision->>'is_recommended')::boolean;
  NEW.trust_score := public.calculate_trust_score(NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_recommend_review ON public.reviews;
DROP TRIGGER IF EXISTS auto_recommend_review_timeline_aware_trigger ON public.reviews;

CREATE TRIGGER reviews_apply_recommendation_trigger
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_apply_recommendation();

DROP FUNCTION IF EXISTS public.auto_recommend_review();
DROP FUNCTION IF EXISTS public.auto_recommend_review_timeline_aware();

-- 7. SHARED RECOMPUTE ---------------------------------------------------------
-- Single write to reviews; the BEFORE trigger above derives is_recommended and
-- trust_score from the new values, so there is no recompute recursion.
CREATE OR REPLACE FUNCTION public.recompute_review_timeline_state(p_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
  v_latest numeric;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.review_updates
  WHERE review_id = p_review_id;

  SELECT u.rating INTO v_latest
  FROM public.review_updates u
  WHERE u.review_id = p_review_id
    AND u.rating IS NOT NULL
  ORDER BY u.created_at DESC, u.id DESC
  LIMIT 1;

  UPDATE public.reviews
  SET timeline_count = v_count,
      has_timeline   = (v_count > 0),
      latest_rating  = v_latest,
      updated_at     = now()
  WHERE id = p_review_id;
END;
$$;

-- 8. TIMELINE TRIGGERS --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_updates_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Serialize every timeline mutation for this review before touching it.
  PERFORM pg_advisory_xact_lock(public.review_timeline_lock_key(NEW.review_id));

  -- Server-owned chronology: client-supplied values are overwritten, not rejected.
  NEW.created_at := now();
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_updates_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.recompute_review_timeline_state(NEW.review_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_review_timeline_stats ON public.review_updates;
DROP TRIGGER IF EXISTS update_review_timeline_stats_enhanced_trigger ON public.review_updates;

CREATE TRIGGER review_updates_before_insert_trigger
  BEFORE INSERT ON public.review_updates
  FOR EACH ROW EXECUTE FUNCTION public.review_updates_before_insert();

CREATE TRIGGER review_updates_after_insert_trigger
  AFTER INSERT ON public.review_updates
  FOR EACH ROW EXECUTE FUNCTION public.review_updates_after_insert();

DROP FUNCTION IF EXISTS public.update_review_timeline_stats();
DROP FUNCTION IF EXISTS public.update_review_timeline_stats_enhanced();

-- 9. OWNER LIFO UNDO RPC ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_latest_review_update(
  p_review_id uuid,
  p_expected_update_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_owner   uuid;
  v_latest  uuid;
  v_deleted uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_review_id IS NULL OR p_expected_update_id IS NULL THEN
    RAISE EXCEPTION 'review id and expected update id are required' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_owner FROM public.reviews WHERE id = p_review_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'review not found' USING ERRCODE = '42501';
  END IF;

  IF v_owner <> v_uid THEN
    RAISE EXCEPTION 'not authorized to modify this timeline' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(public.review_timeline_lock_key(p_review_id));

  -- Resolved under the lock.
  SELECT u.id INTO v_latest
  FROM public.review_updates u
  WHERE u.review_id = p_review_id
  ORDER BY u.created_at DESC, u.id DESC
  LIMIT 1;

  IF v_latest IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_latest <> p_expected_update_id THEN
    RETURN jsonb_build_object('status', 'conflict', 'latestUpdateId', v_latest);
  END IF;

  DELETE FROM public.review_updates WHERE id = v_latest
  RETURNING id INTO v_deleted;

  IF v_deleted IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  PERFORM public.recompute_review_timeline_state(p_review_id);

  SELECT u.id INTO v_latest
  FROM public.review_updates u
  WHERE u.review_id = p_review_id
  ORDER BY u.created_at DESC, u.id DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'status', 'deleted',
    'deletedUpdateId', v_deleted,
    'latestUpdateId', v_latest
  );
END;
$$;

-- 10. MAINTENANCE REMOVAL RPC (service_role only, enforced by GRANT) ----------
CREATE OR REPLACE FUNCTION public.admin_delete_review_update(p_update_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_review_id uuid;
  v_deleted   uuid;
BEGIN
  SELECT review_id INTO v_review_id FROM public.review_updates WHERE id = p_update_id;

  IF v_review_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  PERFORM pg_advisory_xact_lock(public.review_timeline_lock_key(v_review_id));

  -- Re-check under the lock: the owner undo may have removed the row while this
  -- call waited, in which case there is nothing to delete and nothing to report.
  IF NOT EXISTS (SELECT 1 FROM public.review_updates WHERE id = p_update_id) THEN
    PERFORM public.recompute_review_timeline_state(v_review_id);
    RETURN jsonb_build_object('status', 'not_found', 'reviewId', v_review_id);
  END IF;

  DELETE FROM public.review_updates WHERE id = p_update_id
  RETURNING id INTO v_deleted;

  IF v_deleted IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found', 'reviewId', v_review_id);
  END IF;

  PERFORM public.recompute_review_timeline_state(v_review_id);

  RETURN jsonb_build_object(
    'status', 'deleted',
    'deletedUpdateId', v_deleted,
    'reviewId', v_review_id
  );
END;
$$;

-- 11. EXPLICIT OWNERSHIP OF THE PRIVILEGED CHAIN ------------------------------
-- postgres owner -> SECURITY DEFINER -> private helper privileges, stated in SQL
-- rather than inherited from whoever ran the migration.
ALTER FUNCTION public.review_timeline_lock_key(uuid) OWNER TO postgres;
ALTER FUNCTION public.resolve_review_recommendation(jsonb, text, text, numeric) OWNER TO postgres;
ALTER FUNCTION public.lookup_latest_recommendation_intent(uuid) OWNER TO postgres;
ALTER FUNCTION public.recompute_review_timeline_state(uuid) OWNER TO postgres;
ALTER FUNCTION public.reviews_apply_recommendation() OWNER TO postgres;
ALTER FUNCTION public.review_updates_before_insert() OWNER TO postgres;
ALTER FUNCTION public.review_updates_after_insert() OWNER TO postgres;
ALTER FUNCTION public.delete_latest_review_update(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.admin_delete_review_update(uuid) OWNER TO postgres;

-- 12. FUNCTION PRIVILEGE HARDENING -------------------------------------------
REVOKE ALL ON FUNCTION public.review_timeline_lock_key(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.resolve_review_recommendation(jsonb, text, text, numeric) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.lookup_latest_recommendation_intent(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.recompute_review_timeline_state(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reviews_apply_recommendation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.review_updates_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.review_updates_after_insert() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_latest_review_update(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_latest_review_update(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_delete_review_update(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_review_update(uuid) TO service_role;