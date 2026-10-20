-- Phase 4 steady state: automatic selection; live remains OFF.
DROP FUNCTION IF EXISTS public.mux_cleanup_claim_live(uuid);

CREATE OR REPLACE FUNCTION public.mux_cleanup_claim_live(p_run_id uuid, p_candidate_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE ctl public.mux_cleanup_live_control%ROWTYPE; c public.mux_deletion_candidates%ROWTYPE;
        v_ref jsonb; v_lease uuid := gen_random_uuid(); v_id uuid;
BEGIN
  SELECT * INTO ctl FROM public.mux_cleanup_live_control WHERE id = 1;
  IF NOT COALESCE(ctl.live_enabled, false) THEN RETURN jsonb_build_object('claimed', false, 'reason', 'live_disabled'); END IF;
  IF ctl.target_candidate_id IS NOT NULL AND p_candidate_id IS NOT NULL AND p_candidate_id <> ctl.target_candidate_id THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'not_target');
  END IF;
  v_id := COALESCE(ctl.target_candidate_id, p_candidate_id);
  IF v_id IS NULL THEN RETURN jsonb_build_object('claimed', false, 'reason', 'no_target'); END IF;
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = v_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('claimed', false, 'reason', 'target_missing'); END IF;

  PERFORM public.mux_lock_assets(ARRAY[c.mux_asset_id]);
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = v_id FOR UPDATE;

  IF c.worker_lease_expires_at IS NOT NULL AND c.worker_lease_expires_at > clock_timestamp() THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'leased');
  END IF;

  IF c.is_destructively_claimed THEN
    IF NOT (c.status = 'deleting' OR (c.status = 'retryable_error' AND c.eligible_at <= clock_timestamp())) THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'not_due_or_terminal', 'status', c.status);
    END IF;
    -- Retry / crash recovery: re-run the authoritative reference check; fail closed.
    v_ref := public.mux_asset_reference_state(c.mux_asset_id);
    IF v_ref->>'state' IS DISTINCT FROM 'unreferenced' THEN
      UPDATE public.mux_deletion_candidates SET status = 'failed_manual', worker_lease_id = NULL,
             worker_lease_expires_at = NULL, last_checked_at = clock_timestamp(),
             last_check_result = CASE WHEN v_ref->>'state' = 'referenced' THEN 'unexpected_post_claim_reference' ELSE 'post_claim_ambiguous' END
       WHERE id = c.id;
      INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
      VALUES (p_run_id,'live',c.id,c.mux_asset_id,'failed_manual',
              jsonb_build_object('reason', CASE WHEN v_ref->>'state' = 'referenced' THEN 'unexpected_post_claim_reference' ELSE 'post_claim_ambiguous' END,
                                 'reference', COALESCE(v_ref,'{}'::jsonb)));
      RETURN jsonb_build_object('claimed', false, 'reason', 'post_claim_not_unreferenced');
    END IF;
    UPDATE public.mux_deletion_candidates SET status = 'deleting', worker_lease_id = v_lease,
           worker_lease_expires_at = clock_timestamp() + interval '2 minutes',
           last_checked_at = clock_timestamp() WHERE id = c.id;
  ELSE
    IF c.status NOT IN ('pending_grace','eligible') OR c.eligible_at > clock_timestamp() THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'not_eligible', 'status', c.status);
    END IF;
    v_ref := public.mux_asset_reference_state(c.mux_asset_id);
    IF v_ref->>'state' IS DISTINCT FROM 'unreferenced' THEN
      IF v_ref->>'state' = 'referenced' THEN
        UPDATE public.mux_deletion_candidates SET status = 'rescued_referenced', last_checked_at = clock_timestamp(),
               last_check_result = 'referenced' WHERE id = c.id;
        INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
        VALUES (p_run_id,'live',c.id,c.mux_asset_id,'skipped_referenced',COALESCE(v_ref,'{}'::jsonb));
      ELSE
        UPDATE public.mux_deletion_candidates SET status = 'protected_ambiguous', last_checked_at = clock_timestamp(),
               last_check_result = 'ambiguous' WHERE id = c.id;
        INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
        VALUES (p_run_id,'live',c.id,c.mux_asset_id,'skipped_ambiguous',COALESCE(v_ref,'{}'::jsonb));
      END IF;
      RETURN jsonb_build_object('claimed', false, 'reason', 'not_unreferenced');
    END IF;
    PERFORM set_config('mux.live_claim', 'on', true);
    UPDATE public.mux_deletion_candidates SET status = 'deleting', is_destructively_claimed = true,
           destructive_claim_token = gen_random_uuid(), destructive_claimed_at = clock_timestamp(),
           claim_generation = claim_generation + 1, worker_lease_id = v_lease,
           worker_lease_expires_at = clock_timestamp() + interval '2 minutes',
           last_checked_at = clock_timestamp(), last_check_result = 'unreferenced_claimed'
     WHERE id = c.id;
    PERFORM set_config('mux.live_claim', 'off', true);
  END IF;
  INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
  VALUES (p_run_id,'live',c.id,c.mux_asset_id,'claimed_live',jsonb_build_object('retry_count',c.retry_count));
  RETURN jsonb_build_object('claimed', true, 'candidate_id', c.id, 'mux_asset_id', c.mux_asset_id, 'lease_id', v_lease);
END $$;

CREATE OR REPLACE FUNCTION public.mux_cleanup_may_delete(p_candidate_id uuid, p_lease_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mux_cleanup_live_control WHERE id = 1 AND live_enabled
                 AND (target_candidate_id IS NULL OR target_candidate_id = p_candidate_id))
     AND EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE id = p_candidate_id AND status = 'deleting'
                 AND is_destructively_claimed AND worker_lease_id = p_lease_id
                 AND worker_lease_expires_at > clock_timestamp() + interval '15 seconds')
$$;

CREATE OR REPLACE FUNCTION public.mux_cleanup_due_live(p_limit int DEFAULT 10)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT id FROM public.mux_deletion_candidates
   WHERE (status IN ('pending_grace','eligible') AND NOT is_destructively_claimed AND eligible_at <= clock_timestamp())
      OR (status = 'retryable_error' AND is_destructively_claimed AND eligible_at <= clock_timestamp())
      OR (status = 'deleting' AND is_destructively_claimed
          AND (worker_lease_expires_at IS NULL OR worker_lease_expires_at <= clock_timestamp()))
   ORDER BY eligible_at ASC, id
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 10)
$$;

REVOKE ALL ON FUNCTION public.mux_cleanup_claim_live(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mux_cleanup_may_delete(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mux_cleanup_due_live(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mux_cleanup_claim_live(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mux_cleanup_may_delete(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mux_cleanup_due_live(int) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'mux_cleanup_cron_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'mux_cleanup_cron_secret');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_valid_mux_cleanup_cron_secret(p_presented text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_presented IS NOT NULL AND p_presented <> '' AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'mux_cleanup_cron_secret' AND decrypted_secret = p_presented);
$$;
REVOKE ALL ON FUNCTION public.is_valid_mux_cleanup_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_mux_cleanup_cron_secret(text) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mux-cleanup-live-hourly') THEN
    PERFORM cron.unschedule('mux-cleanup-live-hourly');
  END IF;
END $$;

SELECT cron.schedule('mux-cleanup-live-hourly', '50 * * * *', $$
  SELECT net.http_post(
    url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/mux-cleanup-live',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mux_cleanup_cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 60000) AS request_id;
$$);