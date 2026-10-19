-- Phase 4 (minimal): controlled live Mux deletion. Live OFF by default.
CREATE TABLE public.mux_cleanup_live_control (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  live_enabled boolean NOT NULL DEFAULT false,
  target_candidate_id uuid REFERENCES public.mux_deletion_candidates(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT ALL ON public.mux_cleanup_live_control TO service_role;
REVOKE ALL ON public.mux_cleanup_live_control FROM PUBLIC, anon, authenticated;
ALTER TABLE public.mux_cleanup_live_control ENABLE ROW LEVEL SECURITY;
INSERT INTO public.mux_cleanup_live_control (id, live_enabled) VALUES (1, false);

ALTER TABLE public.mux_cleanup_audit_logs DROP CONSTRAINT IF EXISTS mux_cleanup_audit_logs_action_check;
ALTER TABLE public.mux_cleanup_audit_logs ADD CONSTRAINT mux_cleanup_audit_logs_action_check CHECK (action IN (
  'promoted_eligible','rescued_referenced','kept_protected','simulated_would_delete',
  'skipped_referenced','skipped_ambiguous','skipped_destructive','deleted_live','reconciled_404','errored',
  'claimed_live','retry_scheduled','failed_manual'));

CREATE OR REPLACE FUNCTION public.mux_candidates_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'mux_deletion_candidates rows cannot be deleted' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := clock_timestamp();
  IF OLD.is_destructively_claimed THEN
    IF NOT NEW.is_destructively_claimed
       OR NEW.destructive_claim_token IS DISTINCT FROM OLD.destructive_claim_token
       OR NEW.destructive_claimed_at IS DISTINCT FROM OLD.destructive_claimed_at
       OR NEW.claim_generation <> OLD.claim_generation
       OR NEW.mux_asset_id <> OLD.mux_asset_id THEN
      RAISE EXCEPTION 'destructive barrier is immutable' USING ERRCODE = '42501';
    END IF;
    IF NOT ((OLD.status = NEW.status)
      OR (OLD.status = 'deleting' AND NEW.status IN ('deleted','reconciled_already_deleted','retryable_error','failed_manual'))
      OR (OLD.status = 'retryable_error' AND NEW.status IN ('deleting','failed_manual'))) THEN
      RAISE EXCEPTION 'illegal transition % -> % on claimed asset', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
    IF OLD.status IN ('deleted','reconciled_already_deleted') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'terminal state is final' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.mux_asset_id <> OLD.mux_asset_id THEN
      RAISE EXCEPTION 'asset identity is immutable' USING ERRCODE = '42501';
    END IF;
    IF NEW.is_destructively_claimed AND COALESCE(current_setting('mux.live_claim', true), '') <> 'on' THEN
      RAISE EXCEPTION 'destructive claims only via mux_cleanup_claim_live' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mux_cleanup_claim_live(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE ctl public.mux_cleanup_live_control%ROWTYPE; c public.mux_deletion_candidates%ROWTYPE;
        v_ref jsonb; v_lease uuid := gen_random_uuid();
BEGIN
  SELECT * INTO ctl FROM public.mux_cleanup_live_control WHERE id = 1;
  IF NOT COALESCE(ctl.live_enabled, false) THEN RETURN jsonb_build_object('claimed', false, 'reason', 'live_disabled'); END IF;
  IF ctl.target_candidate_id IS NULL THEN RETURN jsonb_build_object('claimed', false, 'reason', 'no_target'); END IF;
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = ctl.target_candidate_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('claimed', false, 'reason', 'target_missing'); END IF;

  PERFORM public.mux_lock_assets(ARRAY[c.mux_asset_id]);
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = ctl.target_candidate_id FOR UPDATE;

  IF c.worker_lease_expires_at IS NOT NULL AND c.worker_lease_expires_at > clock_timestamp() THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'leased');
  END IF;

  IF c.is_destructively_claimed THEN
    IF NOT (c.status = 'deleting' OR (c.status = 'retryable_error' AND c.eligible_at <= clock_timestamp())) THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'not_due_or_terminal', 'status', c.status);
    END IF;
    UPDATE public.mux_deletion_candidates SET status = 'deleting', worker_lease_id = v_lease,
           worker_lease_expires_at = clock_timestamp() + interval '2 minutes' WHERE id = c.id;
  ELSE
    IF c.status NOT IN ('pending_grace','eligible') OR c.eligible_at > clock_timestamp() THEN
      RETURN jsonb_build_object('claimed', false, 'reason', 'not_eligible', 'status', c.status);
    END IF;
    v_ref := public.mux_asset_reference_state(c.mux_asset_id);
    IF v_ref->>'state' IS DISTINCT FROM 'unreferenced' THEN
      IF v_ref->>'state' = 'referenced' THEN
        UPDATE public.mux_deletion_candidates SET status = 'rescued_referenced', last_checked_at = clock_timestamp(),
               last_check_result = 'referenced' WHERE id = c.id;
      END IF;
      INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
      VALUES (p_run_id,'live',c.id,c.mux_asset_id,'skipped_referenced',COALESCE(v_ref,'{}'::jsonb));
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
  SELECT EXISTS (SELECT 1 FROM public.mux_cleanup_live_control WHERE id = 1 AND live_enabled AND target_candidate_id = p_candidate_id)
     AND EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE id = p_candidate_id AND status = 'deleting'
                 AND is_destructively_claimed AND worker_lease_id = p_lease_id
                 AND worker_lease_expires_at > clock_timestamp() + interval '15 seconds')
$$;

CREATE OR REPLACE FUNCTION public.mux_cleanup_finalize_live(p_run_id uuid, p_candidate_id uuid, p_lease_id uuid, p_outcome text, p_http_status int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.mux_deletion_candidates%ROWTYPE; v_asset text; v_status text; v_action text; v_retries int;
BEGIN
  SELECT mux_asset_id INTO v_asset FROM public.mux_deletion_candidates WHERE id = p_candidate_id;
  IF v_asset IS NULL THEN RETURN jsonb_build_object('accepted', false, 'reason', 'lease_fenced'); END IF;
  PERFORM public.mux_lock_assets(ARRAY[v_asset]);
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND OR NOT c.is_destructively_claimed OR c.status <> 'deleting'
     OR c.worker_lease_id IS DISTINCT FROM p_lease_id
     OR c.worker_lease_expires_at IS NULL OR c.worker_lease_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'lease_fenced');
  END IF;
  v_retries := c.retry_count;
  IF p_outcome = 'deleted' THEN v_status := 'deleted'; v_action := 'deleted_live';
  ELSIF p_outcome = 'not_found' THEN v_status := 'reconciled_already_deleted'; v_action := 'reconciled_404';
  ELSIF p_outcome = 'retryable' THEN
    v_retries := v_retries + 1;
    IF v_retries >= 5 THEN v_status := 'failed_manual'; v_action := 'failed_manual';
    ELSE v_status := 'retryable_error'; v_action := 'retry_scheduled'; END IF;
  ELSIF p_outcome = 'failed' THEN v_status := 'failed_manual'; v_action := 'failed_manual';
  ELSE RETURN jsonb_build_object('accepted', false, 'reason', 'bad_outcome');
  END IF;
  UPDATE public.mux_deletion_candidates
     SET status = v_status, retry_count = v_retries, worker_lease_id = NULL, worker_lease_expires_at = NULL,
         eligible_at = CASE WHEN v_status = 'retryable_error' THEN clock_timestamp() + (interval '5 minutes' * power(2, v_retries - 1)) ELSE eligible_at END,
         last_checked_at = clock_timestamp(), last_check_result = p_outcome,
         error_details = CASE WHEN p_outcome IN ('retryable','failed') THEN jsonb_build_object('http_status', p_http_status) ELSE error_details END
   WHERE id = c.id;
  INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
  VALUES (p_run_id,'live',c.id,c.mux_asset_id,v_action,jsonb_build_object('http_status',p_http_status,'retry_count',v_retries));
  RETURN jsonb_build_object('accepted', true, 'status', v_status);
END $$;

REVOKE ALL ON FUNCTION public.mux_cleanup_claim_live(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mux_cleanup_may_delete(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mux_cleanup_finalize_live(uuid, uuid, uuid, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mux_cleanup_claim_live(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mux_cleanup_may_delete(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mux_cleanup_finalize_live(uuid, uuid, uuid, text, int) TO service_role;