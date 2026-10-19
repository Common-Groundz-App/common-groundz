-- Phase 4 rollback — REVIEW DRAFT (rev 2). TWO SEPARATE STAGES.
-- Never removes candidate rows, audit rows, run-ledger rows or barriers
-- (append-only / immutable by design). Claimed rows keep blocking
-- re-attachment forever.

-- =====================================================================
-- STAGE 1 — PAUSE (run immediately; idempotent; safe at any time)
-- Stops new lease acquisition, new claims and the next DELETE. Finalize
-- stays installed so a request already in flight can still record its
-- outcome while its candidate lease is valid.
-- =====================================================================
BEGIN;
CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT 'dry_run'::text $$;
-- Expire any not-yet-used approvals (rows kept as evidence).
UPDATE public.mux_cleanup_live_targets SET expires_at = clock_timestamp()
 WHERE consumed_at IS NULL AND expires_at > clock_timestamp();
COMMIT;

-- Wait >= mux_live_lease_seconds() (120 s) before Stage 2, then inspect:
--   SELECT status, count(*) FROM mux_deletion_candidates WHERE is_destructively_claimed GROUP BY 1;
--   SELECT * FROM mux_cleanup_live_run_lease;

-- =====================================================================
-- STAGE 2 — TEARDOWN (separate approval; refuses while work is in flight)
-- =====================================================================
BEGIN;
DO $$ BEGIN
  IF public.mux_cleanup_mode() IS DISTINCT FROM 'dry_run' THEN
    RAISE EXCEPTION 'stage 1 (pause) not applied';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mux_cleanup_live_run_lease WHERE expires_at > clock_timestamp()) THEN
    RAISE EXCEPTION 'a live run lease is still unexpired';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mux_deletion_candidates
              WHERE status = 'deleting' AND worker_lease_expires_at > clock_timestamp()) THEN
    RAISE EXCEPTION 'a candidate lease is still unexpired';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.mux_cleanup_claim_live(uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.mux_cleanup_pre_delete_gate(uuid,uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.mux_cleanup_finalize_live(uuid,uuid,uuid,text,int);
DROP FUNCTION IF EXISTS public.mux_cleanup_acquire_run_lease(uuid);
DROP FUNCTION IF EXISTS public.mux_cleanup_release_run_lease(uuid,uuid,text,jsonb,text);
DROP FUNCTION IF EXISTS public.mux_cleanup_run_lease_held(uuid,uuid,interval);
DROP FUNCTION IF EXISTS public.mux_live_backoff(int,int);
DROP FUNCTION IF EXISTS public.mux_live_lease_seconds();
DROP FUNCTION IF EXISTS public.mux_live_run_lease_seconds();
DROP FUNCTION IF EXISTS public.mux_live_max_retries();
DROP FUNCTION IF EXISTS public.mux_live_exact_only();

-- Restore Phase 3 guard: no new destructive claim possible.
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
    RAISE EXCEPTION 'live destructive claims are not available in this phase' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Restore the dashboard overview exactly as installed by 20261018173352
-- (copied verbatim; must not reference mux_cleanup_live_run_lease).
CREATE OR REPLACE FUNCTION public.admin_mux_cleanup_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_counts jsonb; v_sched jsonb; v_jobs jsonb; v_active int; v_total int;
BEGIN
  PERFORM public.mux_cleanup_require_admin();
  SELECT COALESCE(jsonb_object_agg(status, n), '{}') INTO v_counts
    FROM (SELECT status, count(*) n FROM public.mux_deletion_candidates GROUP BY status) s;
  BEGIN
    EXECUTE $q$SELECT COALESCE(jsonb_agg(jsonb_build_object('jobname',jobname,'schedule',schedule,'active',active) ORDER BY jobname),'[]'),
                      count(*) FILTER (WHERE active), count(*)
               FROM cron.job WHERE jobname LIKE 'mux-cleanup-%'$q$ INTO v_jobs, v_active, v_total;
    v_sched := jsonb_build_object('state',
      CASE WHEN v_total = 0 THEN 'not_scheduled'
           WHEN v_active > 0 THEN 'active'
           ELSE 'inactive' END, 'jobs', v_jobs);
  EXCEPTION WHEN others THEN
    v_sched := jsonb_build_object('state','scheduler_unavailable');
  END;
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
    'last_dry_run', (SELECT public.mux_cleanup_run_json(r) FROM public.mux_cleanup_runs r WHERE kind='dry_run' ORDER BY started_at DESC, id DESC LIMIT 1));
END $$;

DROP TABLE public.mux_cleanup_live_run_lease;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mux_cleanup_live_targets) THEN
    DROP TABLE public.mux_cleanup_live_targets;   -- kept as evidence if it has rows
  END IF;
END $$;
-- CHECKs on audit actions and runs kind/trigger_source stay widened so
-- existing Phase 4 rows remain valid.
COMMIT;
-- Post-teardown: rows left in 'deleting' (expired lease) or 'retryable_error'
-- stay barrier-protected; resolve with mux-inventory (present/absent).
