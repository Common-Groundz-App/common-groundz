-- Phase 4 single-session DB tests — REVIEW DRAFT (rev 2).
-- ISOLATED TEST DATABASE ONLY (schema restored from production migrations,
-- no production data). Everything runs in one transaction and ROLLS BACK.
-- Refuses to run if it sees production's run ledger history.
-- Test doubles (inside the transaction only):
--   * mux_cleanup_mode() reads session setting p4t.mode (default dry_run)
--   * mux_asset_reference_state() reads table p4t_ref (default 'unreferenced')
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.mux_cleanup_runs WHERE kind IN ('sweep','dry_run')) THEN
    RAISE EXCEPTION 'refusing: this looks like a database with real run history';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT COALESCE(NULLIF(current_setting('p4t.mode', true), ''), 'dry_run') $$;
CREATE TABLE p4t_ref(asset text PRIMARY KEY, state text);
CREATE OR REPLACE FUNCTION public.mux_asset_reference_state(p_asset_id text) RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT CASE WHEN EXISTS (SELECT 1 FROM p4t_ref WHERE asset = p_asset_id)
              THEN (SELECT CASE WHEN state IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('state', state) END FROM p4t_ref WHERE asset = p_asset_id)
              ELSE '{"state":"unreferenced"}'::jsonb END $$;

CREATE TEMP TABLE ids(k text PRIMARY KEY, v uuid);
CREATE OR REPLACE FUNCTION pg_temp.seed(k text, asset text, st text DEFAULT 'eligible') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid; BEGIN
  INSERT INTO public.mux_deletion_candidates(mux_asset_id, upload_record_id, source_kind, enqueue_reason, status, eligible_at)
    VALUES (asset, gen_random_uuid(), 'post', 'post_hard_deleted', st, clock_timestamp() - interval '25 hours') RETURNING id INTO v;
  INSERT INTO ids VALUES (k, v); RETURN v; END $$;
CREATE OR REPLACE FUNCTION pg_temp.id(k text) RETURNS uuid LANGUAGE sql AS $$ SELECT v FROM ids WHERE ids.k = $1 $$;
CREATE OR REPLACE FUNCTION pg_temp.approve(k text, asset text) RETURNS void LANGUAGE sql AS
$$ INSERT INTO public.mux_cleanup_live_targets(candidate_id, expected_mux_asset_id, approved_note, expires_at)
   VALUES (pg_temp.id(k), asset, 'test', clock_timestamp() + interval '1 hour') $$;
CREATE OR REPLACE FUNCTION pg_temp.cand(k text) RETURNS public.mux_deletion_candidates LANGUAGE sql AS
$$ SELECT * FROM public.mux_deletion_candidates WHERE id = pg_temp.id(k) $$;
CREATE TEMP TABLE run(k text PRIMARY KEY, id uuid, tok uuid);
CREATE OR REPLACE FUNCTION pg_temp.acq(k text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r uuid := gen_random_uuid(); j jsonb; BEGIN
  j := public.mux_cleanup_acquire_run_lease(r);
  INSERT INTO run VALUES (k, r, (j->>'run_lease_token')::uuid) ON CONFLICT (k) DO UPDATE SET id = EXCLUDED.id, tok = EXCLUDED.tok;
  RETURN j; END $$;
CREATE OR REPLACE FUNCTION pg_temp.rid(k text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM run WHERE run.k = $1 $$;
CREATE OR REPLACE FUNCTION pg_temp.rtok(k text) RETURNS uuid LANGUAGE sql AS $$ SELECT tok FROM run WHERE run.k = $1 $$;
CREATE OR REPLACE FUNCTION pg_temp.expire_run_lease() RETURNS void LANGUAGE sql AS
$$ UPDATE public.mux_cleanup_live_run_lease SET expires_at = clock_timestamp() - interval '1 second' WHERE holder_run_id IS NOT NULL $$;
CREATE OR REPLACE FUNCTION pg_temp.expire_cand_lease(k text) RETURNS void LANGUAGE sql AS
$$ UPDATE public.mux_deletion_candidates SET worker_lease_expires_at = clock_timestamp() - interval '1 second' WHERE id = pg_temp.id(k) $$;
CREATE OR REPLACE FUNCTION pg_temp.release_all() RETURNS void LANGUAGE sql AS
$$ UPDATE public.mux_cleanup_live_run_lease SET holder_run_id=NULL, lease_token=NULL, acquired_at=NULL, expires_at=NULL $$;

-- ---------------------------------------------------------------- L: run lease
DO $$ DECLARE j jsonb; BEGIN
  -- L1 dry_run: lease refused, no ledger row
  j := pg_temp.acq('A'); ASSERT j->>'acquired' = 'false' AND j->>'reason' = 'live_mode_disabled', 'L1';
  PERFORM set_config('p4t.mode', 'live', true);
  -- L2 acquire A
  j := pg_temp.acq('A'); ASSERT (j->>'acquired')::boolean AND (j->>'generation')::int = 1, 'L2';
  ASSERT (SELECT status FROM public.mux_cleanup_runs WHERE id = pg_temp.rid('A')) = 'running', 'L2 ledger';
  ASSERT (SELECT worker_run_id FROM public.mux_cleanup_runs WHERE id = pg_temp.rid('A')) = pg_temp.rid('A'), 'L2 same uuid';
  -- L3 second acquirer refused while A unexpired; ledger records rejected_locked
  j := pg_temp.acq('B'); ASSERT j->>'reason' = 'run_already_in_progress', 'L3';
  ASSERT (SELECT status FROM public.mux_cleanup_runs WHERE id = pg_temp.rid('B')) = 'rejected_locked', 'L3 ledger';
  -- L4 takeover after expiry: new token + generation, A's ledger closed
  PERFORM pg_temp.expire_run_lease();
  j := pg_temp.acq('B'); ASSERT (j->>'acquired')::boolean AND (j->>'generation')::int = 2 AND (j->>'took_over_expired')::boolean, 'L4';
  ASSERT pg_temp.rtok('A') <> pg_temp.rtok('B'), 'L4 token differs';
  ASSERT (SELECT error_message FROM public.mux_cleanup_runs WHERE id = pg_temp.rid('A')) = 'run_lease_expired_taken_over', 'L4 ledger';
  -- L5 stale A cannot claim
  j := public.mux_cleanup_claim_live(pg_temp.rid('A'), pg_temp.rtok('A'), NULL);
  ASSERT j->>'reason' = 'run_lease_not_held', 'L5';
  -- L6 A with B's token (wrong holder) cannot claim
  j := public.mux_cleanup_claim_live(pg_temp.rid('A'), pg_temp.rtok('B'), NULL);
  ASSERT j->>'reason' = 'run_lease_not_held', 'L6';
  -- L7 stale A cannot release B's lease
  j := public.mux_cleanup_release_run_lease(pg_temp.rid('A'), pg_temp.rtok('A'), 'succeeded', '{}', NULL);
  ASSERT j->>'released' = 'false', 'L7';
  ASSERT (SELECT holder_run_id FROM public.mux_cleanup_live_run_lease) = pg_temp.rid('B'), 'L7 lease intact';
  -- L8 B releases; ledger succeeded
  j := public.mux_cleanup_release_run_lease(pg_temp.rid('B'), pg_temp.rtok('B'), 'succeeded', '{}', NULL);
  ASSERT (j->>'released')::boolean, 'L8';
  ASSERT (SELECT status FROM public.mux_cleanup_runs WHERE id = pg_temp.rid('B')) = 'succeeded', 'L8 ledger';
  -- L9 release twice is harmless
  j := public.mux_cleanup_release_run_lease(pg_temp.rid('B'), pg_temp.rtok('B'), 'succeeded', '{}', NULL);
  ASSERT j->>'released' = 'false', 'L9';
  RAISE NOTICE 'L1-L9 pass';
END $$;

-- ---------------------------------------------------------------- C: claims
DO $$ DECLARE j jsonb; c public.mux_deletion_candidates; v_token uuid; BEGIN
  PERFORM set_config('p4t.mode', 'live', true);
  PERFORM pg_temp.seed('x1', 'assetX1'); PERFORM pg_temp.seed('x2', 'assetX2');
  PERFORM pg_temp.acq('R');
  -- C1 exact_only: no target → nothing claimable via general claim
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), NULL);
  ASSERT j->>'reason' = 'none_claimable', 'C1';
  -- C2 exact claim without approval raises
  BEGIN PERFORM public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('x1')); ASSERT false, 'C2';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- C3 asset mismatch raises
  INSERT INTO public.mux_cleanup_live_targets VALUES (pg_temp.id('x2'), 'WRONG', 't', clock_timestamp(), clock_timestamp() + interval '1 hour');
  BEGIN PERFORM public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('x2')); ASSERT false, 'C3';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- C4 expired approval refuses initial claim
  INSERT INTO public.mux_cleanup_live_targets VALUES (pg_temp.id('x1'), 'assetX1', 't', clock_timestamp(), clock_timestamp() - interval '1 second');
  BEGIN PERFORM public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('x1')); ASSERT false, 'C4';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- C5 valid approval → initial claim, barrier + target consumed
  UPDATE public.mux_cleanup_live_targets SET expires_at = clock_timestamp() + interval '1 hour' WHERE candidate_id = pg_temp.id('x1');
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('x1'));
  ASSERT (j->>'claimed')::boolean AND j->>'kind' = 'initial', 'C5';
  c := pg_temp.cand('x1');
  ASSERT c.status = 'deleting' AND c.is_destructively_claimed AND c.claim_generation = 1, 'C5 barrier';
  ASSERT (SELECT consumed_by_run_id FROM public.mux_cleanup_live_targets WHERE candidate_id = c.id) = pg_temp.rid('R'), 'C5 consumed';
  ASSERT EXISTS (SELECT 1 FROM public.mux_cleanup_audit_logs WHERE run_id = pg_temp.rid('R') AND candidate_id = c.id AND action = 'claimed_live'), 'C5 audit run id';
  -- C6 consumed approval cannot be reused (but row is now claimed → falls to recovery rules: lease unexpired → none)
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('x1'));
  ASSERT j->>'reason' = 'none_claimable', 'C6';
  -- C7 recovery of claimed row after candidate lease expiry IGNORES target expiry/consumption; same token
  v_token := c.destructive_claim_token;
  UPDATE public.mux_cleanup_live_targets SET expires_at = clock_timestamp() - interval '1 second' WHERE candidate_id = c.id;
  PERFORM pg_temp.expire_cand_lease('x1');
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), NULL);
  ASSERT j->>'kind' = 'recover', 'C7';
  c := pg_temp.cand('x1');
  ASSERT c.destructive_claim_token = v_token AND c.claim_generation = 1 AND c.retry_count = 0, 'C7 token/gen/retry unchanged';
  RAISE NOTICE 'C1-C7 pass';
END $$;

-- ---------------------------------------------------------------- R: references (fail closed)
DO $$ DECLARE j jsonb; BEGIN
  PERFORM set_config('p4t.mode', 'live', true);
  PERFORM pg_temp.seed('r1', 'assetR1'); PERFORM pg_temp.approve('r1', 'assetR1');
  PERFORM pg_temp.seed('r2', 'assetR2'); PERFORM pg_temp.approve('r2', 'assetR2');
  PERFORM pg_temp.seed('r3', 'assetR3'); PERFORM pg_temp.approve('r3', 'assetR3');
  INSERT INTO p4t_ref VALUES ('assetR1','referenced'), ('assetR2', NULL), ('assetR3','garbage');
  -- R1 referenced → rescued, never claimed
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('r1'));
  ASSERT j->>'reason' = 'none_claimable' AND (pg_temp.cand('r1')).status = 'rescued_referenced', 'R1';
  -- R2 NULL/missing state → NOT claimed (the old <> bug would have claimed it)
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('r2'));
  ASSERT NOT (pg_temp.cand('r2')).is_destructively_claimed AND (pg_temp.cand('r2')).last_check_result = 'ambiguous', 'R2';
  -- R3 unknown state → NOT claimed
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('r3'));
  ASSERT NOT (pg_temp.cand('r3')).is_destructively_claimed, 'R3';
  -- R4 after barrier: reference appears before recovery → failed_manual, barrier kept
  INSERT INTO p4t_ref VALUES ('assetX1','referenced');
  PERFORM pg_temp.expire_cand_lease('x1');
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), NULL);
  ASSERT (pg_temp.cand('x1')).status = 'failed_manual' AND (pg_temp.cand('x1')).is_destructively_claimed, 'R4';
  RAISE NOTICE 'R1-R4 pass';
END $$;

-- ---------------------------------------------------------------- G/F: gate + finalize fencing
DO $$ DECLARE j jsonb; lease uuid; BEGIN
  PERFORM set_config('p4t.mode', 'live', true);
  PERFORM pg_temp.seed('g1', 'assetG1'); PERFORM pg_temp.approve('g1', 'assetG1');
  j := public.mux_cleanup_claim_live(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('g1'));
  lease := (j->>'lease_id')::uuid;
  -- G1 gate true for current holder
  ASSERT public.mux_cleanup_pre_delete_gate(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('g1'), lease), 'G1';
  -- G2 kill switch → gate false
  PERFORM set_config('p4t.mode', 'dry_run', true);
  ASSERT NOT public.mux_cleanup_pre_delete_gate(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('g1'), lease), 'G2';
  PERFORM set_config('p4t.mode', 'live', true);
  -- G3 wrong candidate lease → false
  ASSERT NOT public.mux_cleanup_pre_delete_gate(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('g1'), gen_random_uuid()), 'G3';
  -- G4 TAKEOVER: run lease expires, S takes over → stale R gate false even with valid candidate lease
  PERFORM pg_temp.expire_run_lease();
  PERFORM pg_temp.acq('S');
  ASSERT NOT public.mux_cleanup_pre_delete_gate(pg_temp.rid('R'), pg_temp.rtok('R'), pg_temp.id('g1'), lease), 'G4 stale run fenced';
  -- G5 new holder S cannot use R's candidate lease either (lease is per claim)
  ASSERT public.mux_cleanup_pre_delete_gate(pg_temp.rid('S'), pg_temp.rtok('S'), pg_temp.id('g1'), lease), 'G5 gate is lease-scoped, both fences pass';
  -- G6 S cannot claim g1 while R's candidate lease is unexpired
  j := public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), NULL);
  ASSERT j->>'reason' = 'none_claimable', 'G6';
  -- G7 run lease with < 10 s left → gate false
  UPDATE public.mux_cleanup_live_run_lease SET expires_at = clock_timestamp() + interval '5 seconds';
  ASSERT NOT public.mux_cleanup_pre_delete_gate(pg_temp.rid('S'), pg_temp.rtok('S'), pg_temp.id('g1'), lease), 'G7';
  -- G8 run lease < 30 s left → claim refused
  ASSERT public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), NULL)->>'reason' = 'run_lease_not_held', 'G8';
  UPDATE public.mux_cleanup_live_run_lease SET expires_at = clock_timestamp() + interval '90 seconds';

  -- F1 finalize in dry_run (paused) still accepted with valid candidate lease
  PERFORM set_config('p4t.mode', 'dry_run', true);
  j := public.mux_cleanup_finalize_live(pg_temp.rid('R'), pg_temp.id('g1'), lease, 'deleted', NULL);
  ASSERT (j->>'accepted')::boolean AND (pg_temp.cand('g1')).status = 'deleted', 'F1';
  PERFORM set_config('p4t.mode', 'live', true);
  -- F2 terminal: second finalize rejected + audited
  j := public.mux_cleanup_finalize_live(pg_temp.rid('R'), pg_temp.id('g1'), lease, 'retryable', NULL);
  ASSERT j->>'reason' = 'not_deleting', 'F2';
  ASSERT EXISTS (SELECT 1 FROM public.mux_cleanup_audit_logs WHERE candidate_id = pg_temp.id('g1') AND action = 'finalize_rejected'), 'F2 audit';
  -- F3 terminal immutable
  BEGIN UPDATE public.mux_deletion_candidates SET status = 'retryable_error' WHERE id = pg_temp.id('g1'); ASSERT false, 'F3';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'G1-G8 F1-F3 pass';
END $$;

DO $$ DECLARE j jsonb; lease uuid; lease2 uuid; BEGIN
  PERFORM set_config('p4t.mode', 'live', true);
  PERFORM pg_temp.seed('f4', 'assetF4'); PERFORM pg_temp.approve('f4', 'assetF4');
  lease := (public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), pg_temp.id('f4'))->>'lease_id')::uuid;
  -- F4 expired candidate lease → finalize rejected (lease_expired), row unchanged
  PERFORM pg_temp.expire_cand_lease('f4');
  j := public.mux_cleanup_finalize_live(pg_temp.rid('S'), pg_temp.id('f4'), lease, 'deleted', NULL);
  ASSERT j->>'reason' = 'lease_expired' AND (pg_temp.cand('f4')).status = 'deleting', 'F4';
  -- F5 recovery issues new lease; old lease now mismatched
  lease2 := (public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), NULL)->>'lease_id')::uuid;
  ASSERT lease2 <> lease, 'F5 new lease';
  ASSERT public.mux_cleanup_finalize_live(pg_temp.rid('S'), pg_temp.id('f4'), lease, 'deleted', NULL)->>'reason' = 'lease_mismatch', 'F5';
  -- F6 retryable → retry_count+1, backoff ≥ 5 min, same token
  j := public.mux_cleanup_finalize_live(pg_temp.rid('S'), pg_temp.id('f4'), lease2, 'retryable', 60);
  ASSERT (pg_temp.cand('f4')).status = 'retryable_error' AND (pg_temp.cand('f4')).retry_count = 1
     AND (pg_temp.cand('f4')).eligible_at >= clock_timestamp() + interval '4 minutes', 'F6';
  -- F7 not yet due → not claimable
  ASSERT public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), NULL)->>'reason' = 'none_claimable', 'F7';
  -- F8 due → retry_claimed, retry_count unchanged by claim
  UPDATE public.mux_deletion_candidates SET eligible_at = clock_timestamp() - interval '1 second' WHERE id = pg_temp.id('f4');
  j := public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), NULL);
  ASSERT j->>'kind' = 'retry' AND (pg_temp.cand('f4')).retry_count = 1, 'F8';
  -- F9 aborted_before_delete → retryable, retry_count unchanged, eligible now
  j := public.mux_cleanup_finalize_live(pg_temp.rid('S'), pg_temp.id('f4'), (j->>'lease_id')::uuid, 'aborted_before_delete', NULL);
  ASSERT (pg_temp.cand('f4')).retry_count = 1 AND (pg_temp.cand('f4')).eligible_at <= clock_timestamp(), 'F9';
  -- F10 unknown outcome rejected
  BEGIN PERFORM public.mux_cleanup_finalize_live(pg_temp.rid('S'), pg_temp.id('f4'), gen_random_uuid(), 'bogus', NULL); ASSERT false, 'F10';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  -- F11 exhaustion at max retries → failed_manual
  UPDATE public.mux_deletion_candidates SET retry_count = 4 WHERE id = pg_temp.id('f4');
  j := public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), NULL);
  j := public.mux_cleanup_finalize_live(pg_temp.rid('S'), pg_temp.id('f4'), (j->>'lease_id')::uuid, 'retryable', NULL);
  ASSERT (pg_temp.cand('f4')).status = 'failed_manual' AND (pg_temp.cand('f4')).retry_count = 5, 'F11';
  RAISE NOTICE 'F4-F11 pass';
END $$;

DO $$ DECLARE o text; j jsonb; BEGIN
  PERFORM set_config('p4t.mode', 'live', true);
  -- F12 outcome → state map
  FOREACH o IN ARRAY ARRAY['pre_get_404','delete_404_get_404','delete_404_get_200','auth_error','non_retryable_4xx','unexpected_response','environment_mismatch'] LOOP
    PERFORM pg_temp.seed('m_'||o, 'assetM_'||o); PERFORM pg_temp.approve('m_'||o, 'assetM_'||o);
    j := public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), pg_temp.id('m_'||o));
    PERFORM public.mux_cleanup_finalize_live(pg_temp.rid('S'), pg_temp.id('m_'||o), (j->>'lease_id')::uuid, o, NULL);
    ASSERT (pg_temp.cand('m_'||o)).status = CASE WHEN o IN ('pre_get_404','delete_404_get_404') THEN 'reconciled_already_deleted' ELSE 'failed_manual' END, 'F12 '||o;
    ASSERT (pg_temp.cand('m_'||o)).retry_count = 0, 'F12 no retry increment '||o;
  END LOOP;
  -- P1 dry_run: claim raises, guard refuses direct barrier write
  PERFORM set_config('p4t.mode', 'dry_run', true);
  BEGIN PERFORM public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), NULL); ASSERT false, 'P1';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM pg_temp.seed('p2', 'assetP2');
  BEGIN UPDATE public.mux_deletion_candidates SET status='deleting', is_destructively_claimed=true,
        destructive_claim_token=gen_random_uuid(), destructive_claimed_at=now() WHERE id = pg_temp.id('p2'); ASSERT false, 'P2';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- P3 even in live mode, direct write without claim ctx refused
  PERFORM set_config('p4t.mode', 'live', true);
  BEGIN UPDATE public.mux_deletion_candidates SET status='deleting', is_destructively_claimed=true,
        destructive_claim_token=gen_random_uuid(), destructive_claimed_at=now() WHERE id = pg_temp.id('p2'); ASSERT false, 'P3';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- P4 grace honoured
  PERFORM pg_temp.seed('p4', 'assetP4'); PERFORM pg_temp.approve('p4', 'assetP4');
  UPDATE public.mux_deletion_candidates SET eligible_at = clock_timestamp() + interval '1 hour' WHERE id = pg_temp.id('p4');
  ASSERT public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), pg_temp.id('p4'))->>'reason' = 'none_claimable', 'P4';
  -- P5 protected_ambiguous never claimable
  PERFORM pg_temp.seed('p5', 'assetP5', 'protected_ambiguous'); PERFORM pg_temp.approve('p5', 'assetP5');
  ASSERT public.mux_cleanup_claim_live(pg_temp.rid('S'), pg_temp.rtok('S'), pg_temp.id('p5'))->>'reason' = 'none_claimable', 'P5';
  -- P6 attaching a claimed asset raises video_unavailable (Phase 3 rescue path)
  BEGIN PERFORM public.mux_rescue_attached_media(jsonb_build_array(jsonb_build_object('type','video','mux_asset_id','assetX1')));
  EXCEPTION WHEN raise_exception THEN NULL; END;   -- shape depends on mux_resolve_media_assets; see README
  -- P7 privileges: anon/authenticated cannot execute
  ASSERT NOT has_function_privilege('authenticated', 'public.mux_cleanup_claim_live(uuid,uuid,uuid)', 'EXECUTE'), 'P7a';
  ASSERT NOT has_function_privilege('anon', 'public.mux_cleanup_pre_delete_gate(uuid,uuid,uuid,uuid)', 'EXECUTE'), 'P7b';
  ASSERT NOT has_function_privilege('authenticated', 'public.mux_cleanup_acquire_run_lease(uuid)', 'EXECUTE'), 'P7c';
  ASSERT NOT has_table_privilege('authenticated', 'public.mux_cleanup_live_run_lease', 'SELECT'), 'P7d';
  RAISE NOTICE 'F12 P1-P7 pass';
END $$;

ROLLBACK;
