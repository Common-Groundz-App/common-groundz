-- =====================================================================
-- Mux cleanup Phase 4 — REVIEW DRAFT ONLY. NOT APPLIED.
-- Adds the server-only live-deletion state machine. Does NOT enable it:
-- public.mux_cleanup_mode() is left untouched and still returns 'dry_run',
-- so every claim function below refuses to run. Live activation is a
-- separate one-statement migration (see ACTIVATION at the bottom) that
-- needs its own owner approval.
--
-- Reuses Phase 3 fields only: worker_lease_id / worker_lease_expires_at
-- (per-attempt fence), is_destructively_claimed / destructive_claim_token
-- / destructive_claimed_at / claim_generation (permanent lifecycle barrier),
-- retry_count (incremented ONLY for genuine retryable Mux outcomes),
-- eligible_at (grace and backoff clock), last_check_result, error_details.
--
-- Lock order everywhere: asset advisory lock -> candidate row lock.
-- Every function here is SECURITY DEFINER, pinned search_path, and
-- executable by service_role only. No browser/admin RPC can claim.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Constants (single source of truth; mirrored in worker/constants.ts)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_live_max_retries() RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT 5 $$;
CREATE OR REPLACE FUNCTION public.mux_live_lease_seconds() RETURNS int
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT 120 $$;
-- backoff: 5 min * 2^(retry_count-1), capped at 6 h; Retry-After honoured
-- when larger, capped at 6 h.
CREATE OR REPLACE FUNCTION public.mux_live_backoff(p_retry int, p_retry_after int)
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT LEAST(interval '6 hours',
    GREATEST(interval '5 minutes' * power(2, GREATEST(p_retry,1) - 1),
             make_interval(secs => GREATEST(COALESCE(p_retry_after,0),0))))
$$;

-- ---------------------------------------------------------------------
-- 1. Audit vocabulary (append-only table; only the CHECK is widened)
-- ---------------------------------------------------------------------
ALTER TABLE public.mux_cleanup_audit_logs DROP CONSTRAINT IF EXISTS mux_cleanup_audit_logs_action_check;
ALTER TABLE public.mux_cleanup_audit_logs ADD CONSTRAINT mux_cleanup_audit_logs_action_check CHECK (action IN (
  'promoted_eligible','rescued_referenced','kept_protected','simulated_would_delete',
  'skipped_referenced','skipped_ambiguous','skipped_destructive','deleted_live','reconciled_404','errored',
  -- Phase 4
  'claimed_live','lease_recovered','retry_claimed','retry_scheduled','failed_manual',
  'aborted_before_delete','claim_skipped_referenced','claim_skipped_ambiguous','retries_exhausted'));

-- ---------------------------------------------------------------------
-- 2. Exact-target allowlist (server-only selector for the first test).
--    Empty on install. A row only narrows selection; it bypasses nothing.
-- ---------------------------------------------------------------------
CREATE TABLE public.mux_cleanup_live_targets (
  candidate_id uuid PRIMARY KEY REFERENCES public.mux_deletion_candidates(id) ON DELETE RESTRICT,
  expected_mux_asset_id text NOT NULL,
  approved_note text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
GRANT ALL ON public.mux_cleanup_live_targets TO service_role;
REVOKE ALL ON public.mux_cleanup_live_targets FROM PUBLIC, anon, authenticated;
ALTER TABLE public.mux_cleanup_live_targets ENABLE ROW LEVEL SECURITY;
-- no policies: service_role only

-- ---------------------------------------------------------------------
-- 3. Guard: permit entering the barrier only from the claim function.
--    The barrier remains permanently immutable once set (Phase 3 rule).
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
    -- only mux_cleanup_claim_live sets this transaction-local flag, and it
    -- has already verified live mode, lock, eligibility and zero references.
    IF current_setting('mux_cleanup.claim_ctx', true) IS DISTINCT FROM NEW.destructive_claim_token::text
       OR public.mux_cleanup_mode() <> 'live'
       OR OLD.status <> 'eligible' OR NEW.status <> 'deleting' THEN
      RAISE EXCEPTION 'destructive claim refused' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- (insert guard from Phase 3 is unchanged: no row may be inserted claimed)

-- ---------------------------------------------------------------------
-- 4. Claim (initial / retry / stale-lease recovery). JIT: one asset.
--    Returns NULL when nothing is claimable.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_claim_live(p_run_id uuid, p_candidate_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_pick record; c public.mux_deletion_candidates%ROWTYPE; v_ref jsonb;
  v_token uuid; v_lease uuid := gen_random_uuid(); v_kind text; t public.mux_cleanup_live_targets%ROWTYPE;
BEGIN
  IF public.mux_cleanup_mode() <> 'live' THEN
    RAISE EXCEPTION 'live mode disabled' USING ERRCODE = '42501';
  END IF;

  IF p_candidate_id IS NOT NULL THEN
    SELECT * INTO t FROM public.mux_cleanup_live_targets
     WHERE candidate_id = p_candidate_id AND consumed_at IS NULL AND expires_at > clock_timestamp();
    IF NOT FOUND THEN RAISE EXCEPTION 'exact target not approved' USING ERRCODE = '42501'; END IF;
  END IF;

  FOR v_pick IN
    SELECT id, mux_asset_id FROM public.mux_deletion_candidates
     WHERE (p_candidate_id IS NULL OR id = p_candidate_id)
       AND (  (status = 'eligible' AND NOT is_destructively_claimed AND eligible_at <= clock_timestamp())
           OR (status = 'retryable_error' AND eligible_at <= clock_timestamp())
           OR (status = 'deleting' AND worker_lease_expires_at < clock_timestamp()))
     ORDER BY mux_asset_id
     LIMIT 5
  LOOP
    PERFORM public.mux_lock_assets(ARRAY[v_pick.mux_asset_id]);
    SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = v_pick.id FOR UPDATE;

    IF p_candidate_id IS NOT NULL AND c.mux_asset_id <> t.expected_mux_asset_id THEN
      RAISE EXCEPTION 'exact target asset mismatch' USING ERRCODE = '42501';
    END IF;

    -- revalidate under the lock
    IF NOT ((c.status = 'eligible' AND NOT c.is_destructively_claimed AND c.eligible_at <= clock_timestamp())
         OR (c.status = 'retryable_error' AND c.eligible_at <= clock_timestamp())
         OR (c.status = 'deleting' AND c.worker_lease_expires_at < clock_timestamp())) THEN
      CONTINUE;
    END IF;

    IF c.is_destructively_claimed AND c.retry_count >= public.mux_live_max_retries() THEN
      UPDATE public.mux_deletion_candidates SET status='failed_manual', worker_lease_id=NULL,
             worker_lease_expires_at=NULL, last_check_result='retries_exhausted' WHERE id=c.id;
      INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
        VALUES (p_run_id,'live',c.id,c.mux_asset_id,'retries_exhausted',jsonb_build_object('retry_count',c.retry_count));
      CONTINUE;
    END IF;

    -- authoritative zero-reference proof, initial claim AND every recovery
    v_ref := public.mux_asset_reference_state(c.mux_asset_id);
    IF v_ref->>'state' <> 'unreferenced' THEN
      IF NOT c.is_destructively_claimed THEN
        -- before the barrier: normal Phase 3 semantics
        IF v_ref->>'state' = 'referenced' THEN
          UPDATE public.mux_deletion_candidates SET status='rescued_referenced', last_checked_at=clock_timestamp(),
                 last_check_result='referenced' WHERE id=c.id;
          INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
            VALUES (p_run_id,'live',c.id,c.mux_asset_id,'claim_skipped_referenced',v_ref);
        ELSE
          UPDATE public.mux_deletion_candidates SET last_checked_at=clock_timestamp(), last_check_result='ambiguous' WHERE id=c.id;
          INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
            VALUES (p_run_id,'live',c.id,c.mux_asset_id,'claim_skipped_ambiguous',v_ref);
        END IF;
      ELSE
        -- after the barrier: no DELETE, barrier kept, admin resolves
        UPDATE public.mux_deletion_candidates SET status='failed_manual', worker_lease_id=NULL, worker_lease_expires_at=NULL,
               last_checked_at=clock_timestamp(),
               last_check_result = CASE WHEN v_ref->>'state'='referenced' THEN 'unexpected_post_claim_reference'
                                        ELSE 'post_claim_ambiguous' END
         WHERE id=c.id;
        INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
          VALUES (p_run_id,'live',c.id,c.mux_asset_id,'failed_manual',v_ref);
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
    ELSE
      v_token := c.destructive_claim_token;           -- same lifecycle token, always
      v_kind := CASE WHEN c.status='deleting' THEN 'recover' ELSE 'retry' END;
      UPDATE public.mux_deletion_candidates
         SET status='deleting', worker_lease_id=v_lease,
             worker_lease_expires_at=clock_timestamp() + make_interval(secs => public.mux_live_lease_seconds()),
             last_checked_at=clock_timestamp()
       WHERE id=c.id;                                  -- retry_count NOT touched here
    END IF;

    IF p_candidate_id IS NOT NULL THEN
      UPDATE public.mux_cleanup_live_targets SET consumed_at=clock_timestamp() WHERE candidate_id=c.id;
    END IF;

    INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
      VALUES (p_run_id,'live',c.id,c.mux_asset_id,
              CASE v_kind WHEN 'initial' THEN 'claimed_live' WHEN 'retry' THEN 'retry_claimed' ELSE 'lease_recovered' END,
              jsonb_build_object('retry_count',c.retry_count,'exact_target',p_candidate_id IS NOT NULL));

    RETURN jsonb_build_object('candidate_id',c.id,'mux_asset_id',c.mux_asset_id,
      'upload_record_id',c.upload_record_id,'lease_id',v_lease,'kind',v_kind,'retry_count',c.retry_count);
  END LOOP;
  RETURN NULL;
END $$;

-- ---------------------------------------------------------------------
-- 5. Pre-DELETE gate: lease still ours, unexpired, and mode still live.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_lease_valid(p_candidate_id uuid, p_lease_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.mux_cleanup_mode() = 'live' AND EXISTS (
    SELECT 1 FROM public.mux_deletion_candidates
     WHERE id = p_candidate_id AND status = 'deleting' AND is_destructively_claimed
       AND worker_lease_id = p_lease_id
       AND worker_lease_expires_at > clock_timestamp() + interval '20 seconds')
$$;

-- ---------------------------------------------------------------------
-- 6. Finalize. Caller supplies only an OUTCOME; the server maps it to
--    status/action. Fenced by worker_lease_id (a stale worker whose
--    lease was taken over cannot finalize).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mux_cleanup_finalize_live(
  p_run_id uuid, p_candidate_id uuid, p_lease_id uuid, p_outcome text, p_retry_after_seconds int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c public.mux_deletion_candidates%ROWTYPE; v_status text; v_action text; v_retry int; v_eligible timestamptz;
BEGIN
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = p_candidate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown candidate' USING ERRCODE = '42501'; END IF;
  PERFORM public.mux_lock_assets(ARRAY[c.mux_asset_id]);
  SELECT * INTO c FROM public.mux_deletion_candidates WHERE id = p_candidate_id FOR UPDATE;
  IF c.status <> 'deleting' OR NOT c.is_destructively_claimed OR c.worker_lease_id IS DISTINCT FROM p_lease_id THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'lease_fenced');
  END IF;

  v_retry := c.retry_count; v_eligible := c.eligible_at;
  CASE p_outcome
    WHEN 'deleted'              THEN v_status := 'deleted';                    v_action := 'deleted_live';
    WHEN 'delete_404_get_404'   THEN v_status := 'reconciled_already_deleted'; v_action := 'reconciled_404';
    WHEN 'delete_404_get_200'   THEN v_status := 'failed_manual';              v_action := 'failed_manual';
    WHEN 'auth_error'           THEN v_status := 'failed_manual';              v_action := 'failed_manual';
    WHEN 'non_retryable_4xx'    THEN v_status := 'failed_manual';              v_action := 'failed_manual';
    WHEN 'unexpected_response'  THEN v_status := 'failed_manual';              v_action := 'failed_manual';
    WHEN 'environment_mismatch' THEN v_status := 'failed_manual';              v_action := 'failed_manual';
    WHEN 'aborted_before_delete' THEN                                          -- no Mux request was sent
      v_status := 'retryable_error'; v_action := 'aborted_before_delete'; v_eligible := clock_timestamp();
    WHEN 'retryable', 'delete_404_get_retryable' THEN
      v_retry := c.retry_count + 1;                                            -- genuine API attempt only
      IF v_retry >= public.mux_live_max_retries() THEN
        v_status := 'failed_manual'; v_action := 'retries_exhausted';
      ELSE
        v_status := 'retryable_error'; v_action := 'retry_scheduled';
        v_eligible := clock_timestamp() + public.mux_live_backoff(v_retry, p_retry_after_seconds);
      END IF;
    ELSE RAISE EXCEPTION 'unknown outcome' USING ERRCODE = '22023';
  END CASE;

  UPDATE public.mux_deletion_candidates
     SET status=v_status, retry_count=v_retry, eligible_at=v_eligible,
         worker_lease_id=NULL, worker_lease_expires_at=NULL,
         last_checked_at=clock_timestamp(), last_check_result=p_outcome,
         error_details = CASE WHEN v_status IN ('deleted','reconciled_already_deleted') THEN NULL
                              ELSE jsonb_build_object('category', p_outcome) END
   WHERE id=c.id;
  INSERT INTO public.mux_cleanup_audit_logs(run_id,mode,candidate_id,mux_asset_id,action,details)
    VALUES (p_run_id,'live',c.id,c.mux_asset_id,v_action,
            jsonb_build_object('outcome',p_outcome,'retry_count',v_retry));
  RETURN jsonb_build_object('accepted', true, 'status', v_status);
END $$;

-- ---------------------------------------------------------------------
-- 7. Privileges: service_role only.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  public.mux_live_max_retries(), public.mux_live_lease_seconds(), public.mux_live_backoff(int,int),
  public.mux_cleanup_claim_live(uuid,uuid), public.mux_cleanup_lease_valid(uuid,uuid),
  public.mux_cleanup_finalize_live(uuid,uuid,uuid,text,int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.mux_cleanup_claim_live(uuid,uuid), public.mux_cleanup_lease_valid(uuid,uuid),
  public.mux_cleanup_finalize_live(uuid,uuid,uuid,text,int)
  TO service_role;

COMMIT;

-- =====================================================================
-- ACTIVATION (separate migration, separate approval — NOT part of this):
--   CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text
--   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
--   AS $$ SELECT 'live'::text $$;
-- KILL SWITCH: same statement returning 'dry_run'. Takes effect before the
-- next claim and before the next DELETE (lease_valid re-checks mode).
-- =====================================================================
