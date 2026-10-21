BEGIN;

ALTER TABLE public.mux_uploads
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS is_abandoned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS abandonment_reason text;

ALTER TABLE public.mux_uploads
  ADD CONSTRAINT mux_uploads_kind_check CHECK (kind IS NULL OR kind IN ('post','review','review_update')),
  ADD CONSTRAINT mux_uploads_abandonment_reason_check CHECK (abandonment_reason IS NULL OR abandonment_reason IN ('composer_media_removed','composer_media_replaced','composer_discarded')),
  ADD CONSTRAINT mux_uploads_abandonment_consistent CHECK (is_abandoned = (abandonment_reason IS NOT NULL));

ALTER TABLE public.mux_deletion_candidates DROP CONSTRAINT mux_deletion_candidates_enqueue_reason_check;
ALTER TABLE public.mux_deletion_candidates ADD CONSTRAINT mux_deletion_candidates_enqueue_reason_check
  CHECK (enqueue_reason IN ('post_soft_deleted','post_hard_deleted','post_media_removed','review_hard_deleted','review_media_removed','review_update_hard_deleted','review_update_media_removed','reconciliation_sweep','composer_media_removed','composer_media_replaced','composer_discarded'));

ALTER TABLE public.mux_cleanup_observations DROP CONSTRAINT mux_cleanup_observations_kind_check;
ALTER TABLE public.mux_cleanup_observations ADD CONSTRAINT mux_cleanup_observations_kind_check
  CHECK (kind IN ('unresolved_identity','asset_mismatch','enqueue_on_destructive','sweep_age_only_protected','abandon_enqueue_failed'));

CREATE OR REPLACE FUNCTION public.mux_uploads_kind_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.kind IS NOT NULL AND NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'mux_uploads.kind is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mux_uploads_kind_immutable BEFORE UPDATE OF kind ON public.mux_uploads
  FOR EACH ROW EXECUTE FUNCTION public.mux_uploads_kind_immutable();

CREATE OR REPLACE FUNCTION public.mux_upload_saved_reference(p_upload_id text, p_asset_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p, jsonb_array_elements(CASE WHEN jsonb_typeof(p.media)='array' THEN p.media ELSE '[]' END) e
     WHERE NOT COALESCE(p.is_deleted,false)
       AND (e->>'mux_upload_id' = p_upload_id OR (p_asset_id IS NOT NULL AND e->>'mux_asset_id' = p_asset_id))
    UNION ALL
    SELECT 1 FROM public.reviews r, jsonb_array_elements(CASE WHEN jsonb_typeof(r.media)='array' THEN r.media ELSE '[]' END) e
     WHERE e->>'mux_upload_id' = p_upload_id OR (p_asset_id IS NOT NULL AND e->>'mux_asset_id' = p_asset_id)
    UNION ALL
    SELECT 1 FROM public.review_updates u, jsonb_array_elements(CASE WHEN jsonb_typeof(u.media)='array' THEN u.media ELSE '[]' END) e
     WHERE e->>'mux_upload_id' = p_upload_id OR (p_asset_id IS NOT NULL AND e->>'mux_asset_id' = p_asset_id)
    UNION ALL
    SELECT 1 FROM public.mux_upload_mappings m
     WHERE m.mux_upload_id = p_upload_id AND m.status IN ('pending','patched')
       AND (   (m.content_type='post' AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id=m.content_id AND NOT COALESCE(p.is_deleted,false)))
            OR (m.content_type='review' AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.id=m.content_id))
            OR (m.content_type='review_update' AND EXISTS (SELECT 1 FROM public.review_updates u WHERE u.id=m.content_id)))
  )
$$;
REVOKE ALL ON FUNCTION public.mux_upload_saved_reference(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mux_upload_saved_reference(text, text) TO service_role;

-- Lock protocol: (1) mux_uploads rows by upload_id (2) asset advisory locks sorted (3) candidate rows
CREATE OR REPLACE FUNCTION public.mux_abandon_composer_uploads(p_upload_ids text[], p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_uid uuid := auth.uid(); v_id text; u public.mux_uploads%ROWTYPE; v_res jsonb := '[]'::jsonb;
        v_outcome text; v_ids text[]; v_assets text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('composer_media_removed','composer_media_replaced','composer_discarded') THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE = '22023';
  END IF;
  IF p_upload_ids IS NULL OR cardinality(p_upload_ids) = 0 THEN RETURN jsonb_build_object('results', v_res); END IF;
  IF cardinality(p_upload_ids) > 8 THEN RAISE EXCEPTION 'too_many_uploads' USING ERRCODE = '22023'; END IF;

  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_ids FROM unnest(p_upload_ids) x WHERE x IS NOT NULL AND x <> '';
  IF v_ids IS NULL THEN RETURN jsonb_build_object('results', v_res); END IF;

  PERFORM 1 FROM public.mux_uploads WHERE upload_id = ANY(v_ids) AND user_id = v_uid ORDER BY upload_id FOR UPDATE;
  SELECT array_agg(asset_id) INTO v_assets FROM public.mux_uploads
   WHERE upload_id = ANY(v_ids) AND user_id = v_uid AND asset_id IS NOT NULL;
  IF v_assets IS NOT NULL THEN PERFORM public.mux_lock_assets(v_assets); END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT * INTO u FROM public.mux_uploads WHERE upload_id = v_id AND user_id = v_uid;
    IF NOT FOUND THEN
      v_outcome := 'not_found';
    ELSIF u.kind IS NULL THEN
      v_outcome := 'legacy_kind_unknown';
    ELSIF public.mux_upload_saved_reference(u.upload_id, u.asset_id) THEN
      v_outcome := 'skipped_saved';
    ELSE
      IF NOT u.is_abandoned THEN
        UPDATE public.mux_uploads SET is_abandoned = true, abandonment_reason = p_reason WHERE id = u.id;
      END IF;
      IF u.asset_id IS NULL THEN
        v_outcome := 'deferred_until_asset';
      ELSE
        PERFORM public.mux_enqueue_asset_locked(u.asset_id, u.id, u.kind, COALESCE(u.abandonment_reason, p_reason), NULL);
        v_outcome := 'enqueued';
      END IF;
    END IF;
    v_res := v_res || jsonb_build_object('upload_id', v_id, 'outcome', v_outcome);
  END LOOP;
  RETURN jsonb_build_object('results', v_res);
END $$;
REVOKE ALL ON FUNCTION public.mux_abandon_composer_uploads(text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mux_abandon_composer_uploads(text[], text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mux_rescue_attached_media(p_media jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_assets text[]; v_uploads text[]; v text; c public.mux_deletion_candidates%ROWTYPE;
BEGIN
  SELECT array_agg(DISTINCT mux_upload_id) INTO v_uploads
    FROM public.mux_resolve_media_assets(p_media) WHERE mux_upload_id IS NOT NULL AND mux_upload_id <> '';
  IF v_uploads IS NOT NULL THEN
    PERFORM 1 FROM public.mux_uploads WHERE upload_id = ANY(v_uploads) AND is_abandoned ORDER BY upload_id FOR UPDATE;
  END IF;

  SELECT array_agg(DISTINCT mux_asset_id) INTO v_assets
    FROM public.mux_resolve_media_assets(p_media) WHERE mux_asset_id IS NOT NULL;
  IF v_assets IS NOT NULL THEN
    PERFORM public.mux_lock_assets(v_assets);
    FOREACH v IN ARRAY v_assets LOOP
      SELECT * INTO c FROM public.mux_deletion_candidates WHERE mux_asset_id = v FOR UPDATE;
      CONTINUE WHEN NOT FOUND;
      IF c.is_destructively_claimed THEN
        RAISE EXCEPTION 'video_unavailable' USING ERRCODE = 'P0001', DETAIL = 'mux asset has been removed';
      END IF;
      IF c.status IN ('pending_grace','eligible') THEN
        UPDATE public.mux_deletion_candidates
           SET status = 'rescued_referenced', worker_lease_id = NULL, worker_lease_expires_at = NULL
         WHERE id = c.id;
      END IF;
    END LOOP;
  END IF;

  IF v_uploads IS NOT NULL THEN
    UPDATE public.mux_uploads SET is_abandoned = false, abandonment_reason = NULL
     WHERE upload_id = ANY(v_uploads) AND is_abandoned;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mux_uploads_abandoned_asset_arrived()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.kind IS NULL THEN RETURN NEW; END IF;
  BEGIN
    PERFORM public.mux_lock_assets(ARRAY[NEW.asset_id]);
    IF public.mux_upload_saved_reference(NEW.upload_id, NEW.asset_id) THEN
      NEW.is_abandoned := false;
      NEW.abandonment_reason := NULL;
    ELSE
      PERFORM public.mux_enqueue_asset_locked(NEW.asset_id, NEW.id, NEW.kind, NEW.abandonment_reason, NULL);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- diagnostic only; mux_reconcile_abandoned_uploads() retries hourly
    INSERT INTO public.mux_cleanup_observations (kind, source_kind, mux_upload_id, mux_asset_id, details)
    VALUES ('abandon_enqueue_failed', NEW.kind, NEW.upload_id, NEW.asset_id, jsonb_build_object('sqlstate', SQLSTATE));
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.mux_uploads_abandoned_asset_arrived() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER mux_uploads_abandoned_asset_arrived BEFORE UPDATE OF asset_id ON public.mux_uploads
  FOR EACH ROW WHEN (OLD.asset_id IS NULL AND NEW.asset_id IS NOT NULL AND NEW.is_abandoned)
  EXECUTE FUNCTION public.mux_uploads_abandoned_asset_arrived();

-- Retry path: explicitly abandoned uploads with an asset but no candidate. Not age-based;
-- only rows carrying the authenticated abandonment marker. Same lock order; per-row isolation.
CREATE OR REPLACE FUNCTION public.mux_reconcile_abandoned_uploads(p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT u.id FROM public.mux_uploads u
     WHERE u.is_abandoned AND u.asset_id IS NOT NULL AND u.kind IS NOT NULL AND u.abandonment_reason IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.mux_deletion_candidates c WHERE c.mux_asset_id = u.asset_id)
     ORDER BY u.upload_id LIMIT LEAST(GREATEST(COALESCE(p_limit,25),1),100)
  LOOP
    BEGIN
      PERFORM 1 FROM public.mux_uploads WHERE id = r.id FOR UPDATE SKIP LOCKED;
      IF FOUND THEN
        DECLARE u public.mux_uploads%ROWTYPE;
        BEGIN
          SELECT * INTO u FROM public.mux_uploads WHERE id = r.id;
          IF u.is_abandoned AND u.asset_id IS NOT NULL THEN
            PERFORM public.mux_lock_assets(ARRAY[u.asset_id]);
            IF public.mux_upload_saved_reference(u.upload_id, u.asset_id) THEN
              UPDATE public.mux_uploads SET is_abandoned = false, abandonment_reason = NULL WHERE id = u.id;
            ELSIF NOT EXISTS (SELECT 1 FROM public.mux_deletion_candidates c WHERE c.mux_asset_id = u.asset_id) THEN
              PERFORM public.mux_enqueue_asset_locked(u.asset_id, u.id, u.kind, u.abandonment_reason, NULL);
              n := n + 1;
            END IF;
          END IF;
        END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- left for the next hourly attempt
    END;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mux_reconcile_abandoned_uploads(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mux_reconcile_abandoned_uploads(integer) TO service_role;

-- Run it at the start of every hourly worker invocation (DB-side only; worker code unchanged).
-- Isolated: a reconcile failure never blocks the run record.
CREATE OR REPLACE FUNCTION public.mux_live_run_start(p_worker_run_id uuid, p_trigger_source text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_trigger_source NOT IN ('cron','admin') THEN RAISE EXCEPTION 'invalid trigger source'; END IF;
  INSERT INTO public.mux_cleanup_live_runs (worker_run_id, trigger_source)
    VALUES (p_worker_run_id, p_trigger_source) RETURNING id INTO v_id;
  BEGIN
    PERFORM public.mux_reconcile_abandoned_uploads(25);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN v_id;
END $$;

COMMIT;