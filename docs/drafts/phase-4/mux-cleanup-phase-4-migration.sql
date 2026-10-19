-- =====================================================================
-- Mux cleanup Phase 4 — REVIEW DRAFT ONLY. NOT APPLIED. (rev 2)
-- Adds the server-only live-deletion state machine. Does NOT enable it:
-- public.mux_cleanup_mode() is left untouched and still returns 'dry_run',
-- so the run lease cannot be acquired and nothing can be claimed.
-- Live activation is a separate migration needing its own approval.
--
-- Two independent fences:
--   * GLOBAL RUN LEASE (one live worker per environment): single row in
--     mux_cleanup_live_run_lease, token + generation minted on every
--     acquisition. Fences OUTBOUND work: every claim and every pre-DELETE
--     gate requires (holder_run_id, lease_token) to match and be unexpired.
--     A stale run can never release or overwrite a newer holder.
--   * PER-CANDIDATE LEASE (Phase 3 worker_lease_id/expires_at): fences
--     STATE. Finalize requires the matching, unexpired candidate lease.
--   Ordering: candidate lease (120 s) > run lease (90 s) > worker deadline
--   (55 s) + gate margin (10 s); gate margin (10 s) > one HTTP timeout (6 s).
--
-- The run UUID is the same value in mux_cleanup_runs.id,
-- mux_cleanup_runs.worker_run_id, mux_cleanup_live_run_lease.holder_run_id
-- and every mux_cleanup_audit_logs.run_id written by that run.
--
-- Lock order everywhere: run-lease row -> asset advisory lock ->
-- candidate row -> exact-target row. All functions SECURITY DEFINER,
-- pinned search_path, EXECUTE for service_role only.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Constants (mirrored in worker/outcome.ts LIMITS; tests assert order)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_live_max_retries() RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT 5 $$;
CREATE OR REPLACE FUNCTION public.mux_live_lease_seconds() RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT 120 $$;
CREATE OR REPLACE FUNCTION public.mux_live_run_lease_seconds() RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT 90 $$;
-- First activation is exact-target only: no initial claim without an
-- approved, unexpired allowlist row. Retry/recovery of already-claimed
-- rows is never blocked by this. Changing it needs its own migration.
CREATE OR REPLACE FUNCTION public.mux_live_exact_only() RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT true $$;
-- 5 min * 2^(n-1), cap 6 h; Retry-After honoured when larger (cap 6 h).
CREATE OR REPLACE FUNCTION public.mux_live_backoff(p_retry int, p_retry_after int)
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT LEAST(interval '6 hours',
    GREATEST(interval '5 minutes' * power(2, GREATEST(p_retry,1) - 1),
             make_interval(secs => LEAST(GREATEST(COALESCE(p_retry_after,0),0), 21600))))
$$;

-- ---------------------------------------------------------------------
-- 1. Vocabulary (append-only audit; only CHECKs widened)
-- ---------------------------------------------------------------------
ALTER TABLE public.mux_cleanup_audit_logs DROP CONSTRAINT IF EXISTS mux_cleanup_audit_logs_action_check;
ALTER TABLE public.mux_cleanup_audit_logs ADD CONSTRAINT mux_cleanup_audit_logs_action_check CHECK (action IN (
  'promoted_eligible','rescued_referenced','kept_protected','simulated_would_delete',
  'skipped_referenced','skipped_ambiguous','skipped_destructive','deleted_live','reconciled_404','errored',
  'claimed_live','lease_recovered','retry_claimed','retry_scheduled','failed_manual',
  'aborted_before_delete','claim_skipped_referenced','claim_skipped_ambiguous','retries_exhausted',
  'finalize_rejected'));

ALTER TABLE public.mux_cleanup_runs DROP CONSTRAINT IF EXISTS mux_cleanup_runs_kind_check;
ALTER TABLE public.mux_cleanup_runs ADD CONSTRAINT mux_cleanup_runs_kind_check CHECK (kind IN ('sweep','dry_run','live'));
ALTER TABLE public.mux_cleanup_runs DROP CONSTRAINT IF EXISTS mux_cleanup_runs_trigger_source_check;
ALTER TABLE public.mux_cleanup_runs ADD CONSTRAINT mux_cleanup_runs_trigger_source_check
  CHECK (trigger_source IN ('admin_manual','cron','worker'));

-- ---------------------------------------------------------------------
-- 2. Global live run lease (exactly one row, token-fenced)
-- ---------------------------------------------------------------------
CREATE TABLE public.mux_cleanup_live_run_lease (
  environment text PRIMARY KEY CHECK (environment = 'live'),
  holder_run_id uuid,
  lease_token uuid,
  generation bigint NOT NULL DEFAULT 0,
  acquired_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT mux_run_lease_consistent CHECK (
    (holder_run_id IS NULL AND lease_token IS NULL AND expires_at IS NULL AND acquired_at IS NULL)
    OR (holder_run_id IS NOT NULL AND lease_token IS NOT NULL AND expires_at IS NOT NULL AND acquired_at IS NOT NULL))
);
GRANT ALL ON public.mux_cleanup_live_run_lease TO service_role;
REVOKE ALL ON public.mux_cleanup_live_run_lease FROM PUBLIC, anon, authenticated;
ALTER TABLE public.mux_cleanup_live_run_lease ENABLE ROW LEVEL SECURITY;  -- no policies
INSERT INTO public.mux_cleanup_live_run_lease(environment) VALUES ('live');

-- ---------------------------------------------------------------------
-- 3. Exact-target allowlist. Empty on install. Narrows, bypasses nothing.
--    Expiry/consumption gate NEW destructive claims only.
-- ---------------------------------------------------------------------
CREATE TABLE public.mux_cleanup_live_targets (
  candidate_id uuid PRIMARY KEY REFERENCES public.mux_deletion_candidates(id) ON DELETE RESTRICT,
  expected_mux_asset_id text NOT NULL,
  approved_note text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_run_id uuid
);
GRANT ALL ON public.mux_cleanup_live_targets TO service_role;
REVOKE ALL ON public.mux_cleanup_live_targets FROM PUBLIC, anon, authenticated;
ALTER TABLE public.mux_cleanup_live_targets ENABLE ROW LEVEL SECURITY;  -- no policies

-- ---------------------------------------------------------------------
-- 4. Guard: barrier entry only from the claim function (tx-local ctx).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_candidates_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'mux_deletion_candidates rows cannot be deleted' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := clock_timestamp();
  IF NEW.mux_asset_id <> OLD.mux_asset_id THEN
    RAISE EXCEPTION 'asset identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.is_destructively_claimed THEN
    IF NOT NEW.is_destructively_claimed
       OR NEW.destructive_claim_token IS DISTINCT FROM OLD.destructive_claim_token
       OR NEW.destructive_claimed_at IS DISTINCT FROM OLD.destructive_claimed_at
       OR NEW.claim_generation <> OLD.claim_generation THEN
      RAISE EXCEPTION 'destructive barrier is immutable' USING ERRCODE = '42501';
    END IF;
    IF OLD.status IN ('deleted','reconciled_already_deleted') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'terminal state is final' USING ERRCODE = '42501';
    END IF;
    IF NOT ((OLD.status = NEW.status)
      OR (OLD.status = 'deleting' AND NEW.status IN ('deleted','reconciled_already_deleted','retryable_error','failed_manual'))
      OR (OLD.status = 'retryable_error' AND NEW.status IN ('deleting','failed_manual'))) THEN
      RAISE EXCEPTION 'illegal transition % -> % on claimed asset', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.is_destructively_claimed THEN
    IF current_setting('mux_cleanup.claim_ctx', true) IS DISTINCT FROM NEW.destructive_claim_token::text
       OR public.mux_cleanup_mode() IS DISTINCT FROM 'live'
       OR OLD.status <> 'eligible' OR NEW.status <> 'deleting' THEN
      RAISE EXCEPTION 'destructive claim refused' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 5. Run-lease helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_run_lease_held(p_run_id uuid, p_token uuid, p_margin interval)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT p_run_id IS NOT NULL AND p_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.mux_cleanup_live_run_lease
     WHERE environment = 'live' AND holder_run_id = p_run_id AND lease_token = p_token
       AND expires_at > clock_timestamp() + p_margin)
$$;

CREATE OR REPLACE FUNCTION public.mux_cleanup_acquire_run_lease(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE l public.mux_cleanup_live_run_lease%ROWTYPE; v_token uuid := gen_random_uuid(); v_prev uuid;
BEGIN
  IF p_run_id IS NULL THEN RAISE EXCEPTION 'run id required' USING ERRCODE = '22023'; END IF;
  IF public.mux_cleanup_mode() IS DISTINCT FROM 'live' THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'live_mode_disabled');
  END IF;
  SELECT * INTO l FROM public.mux_cleanup_live_run_lease WHERE environment = 'live' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'run lease row missing' USING ERRCODE = 'P0001'; END IF;

  IF l.holder_run_id IS NOT NULL AND l.expires_at > clock_timestamp() THEN
    INSERT INTO public.mux_cleanup_runs(id, kind, trigger_source, status, worker_run_id, error_message, finished_at)
      VALUES (p_run_id, 'live', 'worker', 'rejected_locked', p_run_id, 'run_already_in_progress', clock_timestamp());
    RETURN jsonb_build_object('acquired', false, 'reason', 'run_already_in_progress');
  END IF;

  v_prev := l.holder_run_id;
  IF l.holder_run_id IS NOT NULL THEN   -- expired holder: takeover; its ledger row is closed
    UPDATE public.mux_cleanup_runs SET status = 'failed', finished_at = clock_timestamp(),
           error_message = 'run_lease_expired_taken_over'
     WHERE id = l.holder_run_id AND status = 'running';
  END IF;

  UPDATE public.mux_cleanup_live_run_lease
     SET holder_run_id = p_run_id, lease_token = v_token, generation = generation + 1,
         acquired_at = clock_timestamp(),
         expires_at = clock_timestamp() + make_interval(secs => public.mux_live_run_lease_seconds()),
         updated_at = clock_timestamp()
   WHERE environment = 'live' RETURNING * INTO l;

  INSERT INTO public.mux_cleanup_runs(id, kind, trigger_source, status, worker_run_id, batch_limit)
    VALUES (p_run_id, 'live', 'worker', 'running', p_run_id, 10);

  RETURN jsonb_build_object('acquired', true, 'run_lease_token', v_token, 'generation', l.generation,
    'expires_at', l.expires_at, 'took_over_expired', v_prev IS NOT NULL);
END $$;

-- Only the current holder with the current token can release. A stale run
-- may close its OWN ledger row (if still 'running') but never touches the lease.
CREATE OR REPLACE FUNCTION public.mux_cleanup_release_run_lease(
  p_run_id uuid, p_run_lease_token uuid, p_status text, p_result jsonb, p_error text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE l public.mux_cleanup_live_run_lease%ROWTYPE; v_owner boolean;
BEGIN
  IF p_status NOT IN ('succeeded','failed') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023'; END IF;
  SELECT * INTO l FROM public.mux_cleanup_live_run_lease WHERE environment = 'live' FOR UPDATE;
  v_owner := l.holder_run_id = p_run_id AND l.lease_token = p_run_lease_token;
  IF v_owner THEN
    UPDATE public.mux_cleanup_live_run_lease
       SET holder_run_id = NULL, lease_token = NULL, acquired_at = NULL, expires_at = NULL, updated_at = clock_timestamp()
     WHERE environment = 'live';
  END IF;
  UPDATE public.mux_cleanup_runs
     SET status = CASE WHEN v_owner THEN p_status ELSE 'failed' END,
         finished_at = clock_timestamp(),
         result = p_result,
         error_message = CASE WHEN v_owner THEN left(p_error, 200) ELSE 'run_lease_lost' END
   WHERE id = p_run_id AND kind = 'live' AND status = 'running';
  RETURN jsonb_build_object('released', COALESCE(v_owner, false),
    'reason', CASE WHEN COALESCE(v_owner, false) THEN NULL ELSE 'not_lease_holder' END);
END $$;

-- ---------------------------------------------------------------------
-- 6. Claim (initial / retry / stale-candidate-lease recovery). JIT: one.
--    Returns {claimed:false, reason} or {claimed:true, ...}.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_claim_live(
  p_run_id uuid, p_run_lease_token uuid, p_candidate_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_pick record; c public.mux_deletion_candidates%ROWTYPE; v_ref jsonb; v_state text;
  v_token uuid; v_lease uuid := gen_random_uuid(); v_kind text;
  t public.mux_cleanup_live_targets%ROWTYPE; v_has_target boolean;
BEGIN
  IF public.mux_cleanup_mode() IS DISTINCT FROM 'live' THEN
    RAISE EXCEPTION 'live mode disabled' USING ERRCODE = '42501';
  END IF;
  -- run lease must cover a full per-asset budget (22 s) plus margin
  PERFORM 1 FROM public.mux_cleanup_live_run_lease WHERE environment = 'live' FOR SHARE;
  IF NOT public.mux_cleanup_run_lease_held(p_run_id, p_run_lease_token, interval '30 seconds') THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'run_lease_not_held');
  END IF;

  FOR v_pick IN
    SELECT id, mux_asset_id FROM public.mux_deletion_candidates
     WHERE (p_candidate_id IS NULL OR id = p_candidate_id)
       AND (  (status = 'eligible' AND NOT is_destructively_claimed AND eligible_at <= clock_timestamp()
               AND (p_candidate_id IS NOT NULL OR NOT public.mux_live_exact_only()))
           OR (status = 'retryable_error' AND is_destructively_claimed AND eligible_at <= clock_timestamp())
           OR (status = 'deleting' AND is_destructively_claimed
               AND (worker_lease_expires_at IS NULL OR worker_lease_expires_at < clock_timestamp())))
     ORDER BY mux_asset_id
     LIMIT 5
  LOOP
    PERFORM public.mux_lock_assets(ARRAY[v_pick.mux_asset_id]);
    SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = v_pick.id FOR UPDATE;

    -- revalidate under the lock
    IF NOT ((c.status = 'eligible' AND NOT c.is_destructively_claimed AND c.eligible_at <= clock_timestamp())
         OR (c.status = 'retryable_error' AND c.is_destructively_claimed AND c.eligible_at <= clock_timestamp())
         OR (c.status = 'deleting' AND c.is_destructively_claimed
             AND (c.worker_lease_expires_at IS NULL OR c.worker_lease_expires_at < clock_timestamp()))) THEN
      CONTINUE;
    END IF;

    -- Exact-target approval gates NEW destructive claims only.
    IF NOT c.is_destructively_claimed THEN
      SELECT * INTO t FROM public.mux_cleanup_live_targets WHERE candidate_id = c.id FOR UPDATE;
      v_has_target := FOUND AND t.consumed_at IS NULL AND t.expires_at > clock_timestamp();
      IF (p_candidate_id IS NOT NULL OR public.mux_live_exact_only()) AND NOT v_has_target THEN
        RAISE EXCEPTION 'exact target not approved' USING ERRCODE = '42501';
      END IF;
      IF v_has_target AND c.mux_asset_id IS DISTINCT FROM t.expected_mux_asset_id THEN
        RAISE EXCEPTION 'exact target asset mismatch' USING ERRCODE = '42501';
      END IF;
    END IF;

    IF c.is_destructively_claimed AND c.retry_count >= public.mux_live_max_retries() THEN
      UPDATE public.mux_deletion_candidates SET status='failed_manual', worker_lease_id=NULL,
             worker_lease_expires_at=NULL, last_check_result='retries_exhausted' WHERE id=c.id;
      INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
        VALUES (p_run_id,'live',c.id,c.mux_asset_id,'retries_exhausted',jsonb_build_object('retry_count',c.retry_count));
      CONTINUE;
    END IF;

    -- Authoritative zero-reference proof on EVERY claim kind. Fail closed:
    -- NULL / missing / unknown state is never treated as unreferenced.
    v_ref := public.mux_asset_reference_state(c.mux_asset_id);
    v_state := v_ref->>'state';
    IF v_state IS DISTINCT FROM 'unreferenced' THEN
      IF NOT c.is_destructively_claimed THEN
        IF v_state = 'referenced' THEN
          UPDATE public.mux_deletion_candidates SET status='rescued_referenced', last_checked_at=clock_timestamp(),
                 last_check_result='referenced' WHERE id=c.id;
          INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
            VALUES (p_run_id,'live',c.id,c.mux_asset_id,'claim_skipped_referenced',jsonb_build_object('state',v_state));
        ELSE
          UPDATE public.mux_deletion_candidates SET last_checked_at=clock_timestamp(), last_check_result='ambiguous' WHERE id=c.id;
          INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
            VALUES (p_run_id,'live',c.id,c.mux_asset_id,'claim_skipped_ambiguous',jsonb_build_object('state',COALESCE(v_state,'null')));
        END IF;
      ELSE
        UPDATE public.mux_deletion_candidates SET status='failed_manual', worker_lease_id=NULL, worker_lease_expires_at=NULL,
               last_checked_at=clock_timestamp(),
               last_check_result = CASE WHEN v_state='referenced' THEN 'unexpected_post_claim_reference' ELSE 'post_claim_ambiguous' END
         WHERE id=c.id;
        INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
          VALUES (p_run_id,'live',c.id,c.mux_asset_id,'failed_manual',jsonb_build_object('state',COALESCE(v_state,'null')));
      END IF;
      CONTINUE;
    END IF;

    IF NOT c.is_destructively_claimed THEN
      v_token := gen_random_uuid(); v_kind := 'initial';
      PERFORM set_config('mux_cleanup.claim_ctx', v_token::text, true);
      UPDATE public.mux_deletion_candidates
         SET status='deleting', is_destructively_claimed=true, destructive_claim_token=v_token,
             destructive_claimed_at=clock_timestamp(), claim_generation=claim_generation+1,
             worker_lease_id=v_lease,
             worker_lease_expires_at=clock_timestamp() + make_interval(secs => public.mux_live_lease_seconds()),
             last_checked_at=clock_timestamp(), last_check_result='claimed'
       WHERE id=c.id;
      PERFORM set_config('mux_cleanup.claim_ctx', '', true);
      UPDATE public.mux_cleanup_live_targets SET consumed_at=clock_timestamp(), consumed_by_run_id=p_run_id
       WHERE candidate_id=c.id;
    ELSE
      v_token := c.destructive_claim_token;               -- same lifecycle token, always
      v_kind := CASE WHEN c.status='deleting' THEN 'recover' ELSE 'retry' END;
      UPDATE public.mux_deletion_candidates
         SET status='deleting', worker_lease_id=v_lease,
             worker_lease_expires_at=clock_timestamp() + make_interval(secs => public.mux_live_lease_seconds()),
             last_checked_at=clock_timestamp()
       WHERE id=c.id;                                      -- retry_count NOT touched
    END IF;

    INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
      VALUES (p_run_id,'live',c.id,c.mux_asset_id,
              CASE v_kind WHEN 'initial' THEN 'claimed_live' WHEN 'retry' THEN 'retry_claimed' ELSE 'lease_recovered' END,
              jsonb_build_object('retry_count',c.retry_count,'exact_target',p_candidate_id IS NOT NULL));

    RETURN jsonb_build_object('claimed', true, 'candidate_id',c.id,'mux_asset_id',c.mux_asset_id,
      'upload_record_id',c.upload_record_id,'lease_id',v_lease,'kind',v_kind,'retry_count',c.retry_count);
  END LOOP;
  RETURN jsonb_build_object('claimed', false, 'reason', 'none_claimable');
END $$;

-- ---------------------------------------------------------------------
-- 7. Pre-DELETE gate. Called immediately before each outbound DELETE.
--    Mode live + run lease (token, holder, >10 s left) + candidate lease
--    (>20 s left). Margins exceed one HTTP timeout, so no takeover can
--    happen while an admitted DELETE is in flight.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_pre_delete_gate(
  p_run_id uuid, p_run_lease_token uuid, p_candidate_id uuid, p_lease_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.mux_cleanup_mode() IS NOT DISTINCT FROM 'live'
     AND public.mux_cleanup_run_lease_held(p_run_id, p_run_lease_token, interval '10 seconds')
     AND EXISTS (
       SELECT 1 FROM public.mux_deletion_candidates
        WHERE id = p_candidate_id AND status = 'deleting' AND is_destructively_claimed
          AND worker_lease_id = p_lease_id
          AND worker_lease_expires_at > clock_timestamp() + interval '20 seconds')
$$;

-- ---------------------------------------------------------------------
-- 8. Finalize. Caller supplies only an OUTCOME; the server maps state.
--    Requires the matching AND unexpired candidate lease. Deliberately
--    does NOT require live mode or the run lease: it records the result of
--    a request already sent, so pausing (rollback stage 1) still lets
--    in-flight work settle. Rejections are audited.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_finalize_live(
  p_run_id uuid, p_candidate_id uuid, p_lease_id uuid, p_outcome text, p_retry_after_seconds int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.mux_deletion_candidates%ROWTYPE; v_status text; v_action text; v_retry int;
        v_eligible timestamptz; v_reason text;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('deleted','pre_get_404','delete_404_get_404','delete_404_get_200',
     'delete_404_get_retryable','retryable','auth_error','non_retryable_4xx','unexpected_response',
     'environment_mismatch','aborted_before_delete') THEN
    RAISE EXCEPTION 'unknown outcome' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = p_candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown candidate' USING ERRCODE = '42501'; END IF;
  PERFORM public.mux_lock_assets(ARRAY[c.mux_asset_id]);
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = p_candidate_id FOR UPDATE;

  v_reason := CASE
    WHEN c.status <> 'deleting' OR NOT c.is_destructively_claimed THEN 'not_deleting'
    WHEN p_lease_id IS NULL OR c.worker_lease_id IS DISTINCT FROM p_lease_id THEN 'lease_mismatch'
    WHEN c.worker_lease_expires_at IS NULL OR c.worker_lease_expires_at <= clock_timestamp() THEN 'lease_expired'
  END;
  IF v_reason IS NOT NULL THEN
    INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
      VALUES (p_run_id,'live',c.id,c.mux_asset_id,'finalize_rejected',
              jsonb_build_object('reason',v_reason,'outcome',p_outcome));
    RETURN jsonb_build_object('accepted', false, 'reason', v_reason);
  END IF;

  v_retry := c.retry_count; v_eligible := c.eligible_at;
  CASE p_outcome
    WHEN 'deleted'              THEN v_status := 'deleted';                    v_action := 'deleted_live';
    WHEN 'delete_404_get_404', 'pre_get_404'
                                THEN v_status := 'reconciled_already_deleted'; v_action := 'reconciled_404';
    WHEN 'aborted_before_delete' THEN                                          -- no DELETE was sent
      v_status := 'retryable_error'; v_action := 'aborted_before_delete'; v_eligible := clock_timestamp();
    WHEN 'retryable', 'delete_404_get_retryable' THEN
      v_retry := c.retry_count + 1;                                            -- genuine Mux attempt only
      IF v_retry >= public.mux_live_max_retries() THEN
        v_status := 'failed_manual'; v_action := 'retries_exhausted';
      ELSE
        v_status := 'retryable_error'; v_action := 'retry_scheduled';
        v_eligible := clock_timestamp() + public.mux_live_backoff(v_retry, p_retry_after_seconds);
      END IF;
    ELSE  -- delete_404_get_200, auth_error, non_retryable_4xx, unexpected_response, environment_mismatch
      v_status := 'failed_manual'; v_action := 'failed_manual';
  END CASE;

  UPDATE public.mux_deletion_candidates
     SET status=v_status, retry_count=v_retry, eligible_at=v_eligible,
         worker_lease_id=NULL, worker_lease_expires_at=NULL,
         last_checked_at=clock_timestamp(), last_check_result=p_outcome,
         error_details = CASE WHEN v_status IN ('deleted','reconciled_already_deleted') THEN NULL
                              ELSE jsonb_build_object('category', p_outcome) END
   WHERE id=c.id;
  INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
    VALUES (p_run_id,'live',c.id,c.mux_asset_id,v_action,jsonb_build_object('outcome',p_outcome,'retry_count',v_retry));
  RETURN jsonb_build_object('accepted', true, 'status', v_status);
END $$;

-- ---------------------------------------------------------------------
-- 9. Dashboard compatibility: overview gains last_live + run-lease state.
--    Body otherwise identical to the installed dashboard version.
--    Run detail already joins audit by worker_run_id (= run id for live).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_mux_cleanup_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_counts jsonb; v_sched jsonb; v_jobs jsonb; v_active int; v_total int; l public.mux_cleanup_live_run_lease%ROWTYPE;
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  SELECT COALESCE(jsonb_object_agg(status, n), '{}') INTO v_counts
    FROM (SELECT status, count(*) n FROM public.mux_deletion_candidates GROUP BY status) s;
  BEGIN
    EXECUTE $q$SELECT COALESCE(jsonb_agg(jsonb_build_object('jobname',jobname,'schedule',schedule,'active',active) ORDER BY jobname),'[]'),
                      count(*) FILTER (WHERE active), count(*)
               FROM cron.job WHERE jobname LIKE 'mux-cleanup-%'$q$ INTO v_jobs, v_active, v_total;
    v_sched := jsonb_build_object('state',
      CASE WHEN v_total = 0 THEN 'not_scheduled' WHEN v_active > 0 THEN 'active' ELSE 'inactive' END, 'jobs', v_jobs);
  EXCEPTION WHEN others THEN
    v_sched := jsonb_build_object('state','scheduler_unavailable');
  END;
  SELECT * INTO l FROM public.mux_cleanup_live_run_lease WHERE environment = 'live';
  RETURN jsonb_build_object(
    'mode', public.mux_cleanup_mode(),
    'schedule', v_sched,
    'counts', v_counts,
    'total', (SELECT count(*) FROM public.mux_deletion_candidates),
    'destructive_claims', (SELECT count(*) FROM public.mux_deletion_candidates WHERE is_destructively_claimed),
    'active_leases', (SELECT count(*) FROM public.mux_deletion_candidates WHERE worker_lease_expires_at > clock_timestamp()),
    'due_now', (SELECT count(*) FROM public.mux_deletion_candidates WHERE status IN ('pending_grace','eligible') AND eligible_at <= clock_timestamp() AND NOT is_destructively_claimed),
    'observations', (SELECT count(*) FROM public.mux_cleanup_observations),
    'last_sweep', (SELECT public.mux_cleanup_run_json(r) FROM public.mux_cleanup_runs r WHERE kind='sweep' ORDER BY started_at DESC, id DESC LIMIT 1),
    'last_dry_run', (SELECT public.mux_cleanup_run_json(r) FROM public.mux_cleanup_runs r WHERE kind='dry_run' ORDER BY started_at DESC, id DESC LIMIT 1),
    'last_live', (SELECT public.mux_cleanup_run_json(r) FROM public.mux_cleanup_runs r WHERE kind='live' ORDER BY started_at DESC, id DESC LIMIT 1),
    'live_run_lease', jsonb_build_object('held', l.holder_run_id IS NOT NULL AND l.expires_at > clock_timestamp(),
       'generation', l.generation, 'expires_at', l.expires_at));   -- token never exposed
END $$;

-- ---------------------------------------------------------------------
-- 10. Privileges: service_role only for every Phase 4 entry point.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  public.mux_live_max_retries(), public.mux_live_lease_seconds(), public.mux_live_run_lease_seconds(),
  public.mux_live_exact_only(), public.mux_live_backoff(int,int),
  public.mux_cleanup_run_lease_held(uuid,uuid,interval),
  public.mux_cleanup_acquire_run_lease(uuid), public.mux_cleanup_release_run_lease(uuid,uuid,text,jsonb,text),
  public.mux_cleanup_claim_live(uuid,uuid,uuid), public.mux_cleanup_pre_delete_gate(uuid,uuid,uuid,uuid),
  public.mux_cleanup_finalize_live(uuid,uuid,uuid,text,int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.mux_cleanup_acquire_run_lease(uuid), public.mux_cleanup_release_run_lease(uuid,uuid,text,jsonb,text),
  public.mux_cleanup_claim_live(uuid,uuid,uuid), public.mux_cleanup_pre_delete_gate(uuid,uuid,uuid,uuid),
  public.mux_cleanup_finalize_live(uuid,uuid,uuid,text,int)
  TO service_role;
-- admin_mux_cleanup_overview keeps its existing grants (CREATE OR REPLACE preserves them).

COMMIT;

-- =====================================================================
-- ACTIVATION (separate migration, separate approval — NOT part of this):
--   CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text
--   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
--   AS $$ SELECT 'live'::text $$;
-- KILL SWITCH: same statement returning 'dry_run'. Blocks the next lease
-- acquisition, the next claim and the next DELETE (gate re-checks mode).
-- =====================================================================
