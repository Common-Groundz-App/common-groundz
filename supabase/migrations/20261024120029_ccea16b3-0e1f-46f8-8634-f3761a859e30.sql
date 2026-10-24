BEGIN;

ALTER TABLE public.mux_uploads DROP CONSTRAINT mux_uploads_abandonment_reason_check;
ALTER TABLE public.mux_uploads ADD CONSTRAINT mux_uploads_abandonment_reason_check
  CHECK (abandonment_reason IS NULL OR abandonment_reason IN ('composer_media_removed','composer_media_replaced','composer_discarded','silent_abandonment'));

ALTER TABLE public.mux_deletion_candidates DROP CONSTRAINT mux_deletion_candidates_enqueue_reason_check;
ALTER TABLE public.mux_deletion_candidates ADD CONSTRAINT mux_deletion_candidates_enqueue_reason_check
  CHECK (enqueue_reason IN ('post_soft_deleted','post_hard_deleted','post_media_removed','review_hard_deleted','review_media_removed','review_update_hard_deleted','review_update_media_removed','reconciliation_sweep','composer_media_removed','composer_media_replaced','composer_discarded','silent_abandonment'));

-- Only the prospective trusted-kind upload cohort is eligible; legacy unknown uploads
-- and all existing candidates (including protected historical assets) are excluded.
-- Existing lock order: upload row -> asset advisory lock -> candidate row.
CREATE FUNCTION public.mux_reconcile_silently_abandoned_uploads(p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record; u public.mux_uploads%ROWTYPE; n integer := 0;
BEGIN
  FOR r IN
    SELECT x.id FROM public.mux_uploads x
     WHERE x.kind IN ('post','review','review_update')
       AND x.asset_id IS NOT NULL
       AND NOT x.is_abandoned AND x.abandonment_reason IS NULL
       AND x.expires_at < clock_timestamp() - interval '1 hour'
       AND NOT EXISTS (SELECT 1 FROM public.mux_deletion_candidates c WHERE c.mux_asset_id = x.asset_id)
       AND NOT public.mux_upload_saved_reference(x.upload_id, x.asset_id)
     ORDER BY x.created_at ASC, x.id ASC
     LIMIT LEAST(GREATEST(COALESCE(p_limit,25),1),100)
  LOOP
    BEGIN
      SELECT * INTO u FROM public.mux_uploads WHERE id = r.id FOR UPDATE SKIP LOCKED;
      CONTINUE WHEN NOT FOUND;
      CONTINUE WHEN u.kind IS NULL OR u.kind NOT IN ('post','review','review_update')
        OR u.asset_id IS NULL OR u.is_abandoned OR u.abandonment_reason IS NOT NULL
        OR u.expires_at >= clock_timestamp() - interval '1 hour';
      PERFORM public.mux_lock_assets(ARRAY[u.asset_id]);
      -- Recheck saved content under the same locks used by saves/webhooks.
      CONTINUE WHEN public.mux_upload_saved_reference(u.upload_id, u.asset_id);
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.mux_deletion_candidates c WHERE c.mux_asset_id = u.asset_id);
      UPDATE public.mux_uploads SET is_abandoned = true, abandonment_reason = 'silent_abandonment' WHERE id = u.id;
      PERFORM public.mux_enqueue_asset_locked(u.asset_id, u.id, u.kind, 'silent_abandonment', NULL);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- marking and enqueue roll back together; retry next invocation
    END;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mux_reconcile_silently_abandoned_uploads(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mux_reconcile_silently_abandoned_uploads(integer) TO service_role;

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
  BEGIN
    PERFORM public.mux_reconcile_silently_abandoned_uploads(25);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN v_id;
END $$;

COMMIT;