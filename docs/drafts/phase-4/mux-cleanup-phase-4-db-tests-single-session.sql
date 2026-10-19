-- Phase 4 single-session state-machine tests — REVIEW DRAFT. NOT RUN.
-- Must run against an ISOLATED test database (a copy/branch with Phase 3 +
-- dashboard + Phase 4 applied). BEGIN/ROLLBACK is cleanup, not isolation:
-- do NOT run on production. Requires live mode inside the test DB, which
-- is simulated by replacing mux_cleanup_mode() INSIDE the transaction.
-- These tests prove transitions/fencing only; they cannot prove races.
BEGIN;
SET LOCAL statement_timeout = '15s';
CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text LANGUAGE sql STABLE
  SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT 'live'::text $$;

CREATE TEMP TABLE r(t text, ok boolean);
-- fixture: one due, unreferenced candidate per test, synthetic p4test_ ids
INSERT INTO public.mux_deletion_candidates(mux_asset_id, source_kind, enqueue_reason, status, eligible_at)
SELECT 'p4test_'||g, 'post','post_hard_deleted','eligible', clock_timestamp() - interval '1 minute'
  FROM generate_series(1,9) g;
-- guarantee only p4test rows are selectable by pinning exact targets
INSERT INTO public.mux_cleanup_live_targets(candidate_id, expected_mux_asset_id, approved_note, expires_at)
SELECT id, mux_asset_id, 'p4test', clock_timestamp() + interval '1 hour'
  FROM public.mux_deletion_candidates WHERE mux_asset_id LIKE 'p4test_%';

CREATE TEMP TABLE ids AS SELECT mux_asset_id a, id FROM public.mux_deletion_candidates WHERE mux_asset_id LIKE 'p4test_%';
CREATE TEMP TABLE cl(a text, j jsonb);

-- T1 initial claim sets barrier, token, lease; retry_count unchanged
INSERT INTO cl SELECT 'p4test_1', public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_1'));
INSERT INTO r SELECT 'T1 claim', c.status='deleting' AND c.is_destructively_claimed AND c.destructive_claim_token IS NOT NULL
  AND c.worker_lease_id = (j->>'lease_id')::uuid AND c.retry_count=0
  FROM public.mux_deletion_candidates c JOIN cl ON cl.a=c.mux_asset_id WHERE c.mux_asset_id='p4test_1';

-- T2 exact target consumed: second claim of same target refused
DO $$ BEGIN PERFORM public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_1'));
  INSERT INTO r VALUES ('T2 consumed target refused', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('T2 consumed target refused', true); END $$;

-- T3 wrong lease cannot finalize (fencing)
INSERT INTO r SELECT 'T3 lease fenced',
  (public.mux_cleanup_finalize_live(gen_random_uuid(), id, gen_random_uuid(), 'deleted'))->>'accepted' = 'false'
  FROM ids WHERE a='p4test_1';

-- T4 deleted is terminal and keeps barrier
SELECT public.mux_cleanup_finalize_live(gen_random_uuid(), i.id, (cl.j->>'lease_id')::uuid, 'deleted')
  FROM ids i JOIN cl ON cl.a=i.a WHERE i.a='p4test_1';
INSERT INTO r SELECT 'T4 deleted terminal', status='deleted' AND is_destructively_claimed AND worker_lease_id IS NULL
  FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_1';
DO $$ BEGIN UPDATE public.mux_deletion_candidates SET status='failed_manual' WHERE mux_asset_id='p4test_1';
  INSERT INTO r VALUES ('T4b terminal immutable', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('T4b terminal immutable', true); END $$;

-- T5 retryable: retry_count+1, backoff, same token preserved on re-claim
INSERT INTO cl SELECT 'p4test_2', public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_2'));
CREATE TEMP TABLE tok AS SELECT destructive_claim_token t FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_2';
SELECT public.mux_cleanup_finalize_live(gen_random_uuid(), i.id, (cl.j->>'lease_id')::uuid, 'retryable', 30)
  FROM ids i JOIN cl ON cl.a=i.a WHERE i.a='p4test_2';
INSERT INTO r SELECT 'T5 retry scheduled', status='retryable_error' AND retry_count=1 AND eligible_at > clock_timestamp() + interval '4 minutes'
  FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_2';
UPDATE public.mux_deletion_candidates SET eligible_at = clock_timestamp() - interval '1 second' WHERE mux_asset_id='p4test_2';
INSERT INTO public.mux_cleanup_live_targets(candidate_id, expected_mux_asset_id, approved_note, expires_at)
  SELECT id, a, 'p4test', clock_timestamp()+interval '1 hour' FROM ids WHERE a='p4test_2'
  ON CONFLICT (candidate_id) DO UPDATE SET consumed_at = NULL;
INSERT INTO r SELECT 'T5b retry same token, count unchanged by claim',
  (public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_2')))->>'kind' = 'retry'
  AND (SELECT destructive_claim_token = (SELECT t FROM tok) AND retry_count = 1 FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_2');

-- T6 stale lease recovery: retry_count NOT incremented
INSERT INTO cl SELECT 'p4test_3', public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_3'));
UPDATE public.mux_deletion_candidates SET worker_lease_expires_at = clock_timestamp() - interval '1 second' WHERE mux_asset_id='p4test_3';
UPDATE public.mux_cleanup_live_targets SET consumed_at=NULL WHERE candidate_id=(SELECT id FROM ids WHERE a='p4test_3');
INSERT INTO r SELECT 'T6 stale recovery',
  (public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_3')))->>'kind' = 'recover'
  AND (SELECT retry_count=0 FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_3');
-- T6b old lease is fenced after takeover
INSERT INTO r SELECT 'T6b old lease fenced',
  (public.mux_cleanup_finalize_live(gen_random_uuid(), i.id, (cl.j->>'lease_id')::uuid, 'deleted'))->>'accepted'='false'
  FROM ids i JOIN cl ON cl.a=i.a WHERE i.a='p4test_3';

-- T7 auth error → failed_manual, no retry increment, barrier kept
INSERT INTO cl SELECT 'p4test_4', public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_4'));
SELECT public.mux_cleanup_finalize_live(gen_random_uuid(), i.id, (cl.j->>'lease_id')::uuid, 'auth_error')
  FROM ids i JOIN cl ON cl.a=i.a WHERE i.a='p4test_4';
INSERT INTO r SELECT 'T7 auth → failed_manual', status='failed_manual' AND retry_count=0 AND is_destructively_claimed
  AND error_details->>'category'='auth_error' FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_4';

-- T8 404 then GET 200 → failed_manual (never deleted)
INSERT INTO cl SELECT 'p4test_5', public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_5'));
SELECT public.mux_cleanup_finalize_live(gen_random_uuid(), i.id, (cl.j->>'lease_id')::uuid, 'delete_404_get_200')
  FROM ids i JOIN cl ON cl.a=i.a WHERE i.a='p4test_5';
INSERT INTO r SELECT 'T8 404+200 fail closed', status='failed_manual' FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_5';

-- T9 exhausted retries → failed_manual, no further claim
UPDATE public.mux_deletion_candidates SET retry_count = 4 WHERE mux_asset_id='p4test_2';
SELECT public.mux_cleanup_finalize_live(gen_random_uuid(), id, worker_lease_id, 'retryable') FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_2';
INSERT INTO r SELECT 'T9 exhausted', status='failed_manual' AND last_check_result='retryable' FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_2';

-- T10 kill switch: mode off → claim refused and lease_valid false
CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text LANGUAGE sql STABLE
  SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT 'dry_run'::text $$;
DO $$ BEGIN PERFORM public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_6'));
  INSERT INTO r VALUES ('T10 kill switch claim', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('T10 kill switch claim', true); END $$;
INSERT INTO r SELECT 'T10b lease_valid false', NOT public.mux_cleanup_lease_valid(id, worker_lease_id) FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_3';
CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text LANGUAGE sql STABLE
  SECURITY DEFINER SET search_path = pg_catalog, public AS $$ SELECT 'live'::text $$;

-- T11 direct UPDATE cannot enter barrier (no claim_ctx)
DO $$ BEGIN UPDATE public.mux_deletion_candidates SET status='deleting', is_destructively_claimed=true,
  destructive_claim_token=gen_random_uuid(), destructive_claimed_at=now() WHERE mux_asset_id='p4test_7';
  INSERT INTO r VALUES ('T11 direct claim refused', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('T11 direct claim refused', true); END $$;

-- T12 exact target asset mismatch refused
UPDATE public.mux_cleanup_live_targets SET expected_mux_asset_id='p4test_wrong' WHERE candidate_id=(SELECT id FROM ids WHERE a='p4test_8');
DO $$ BEGIN PERFORM public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_8'));
  INSERT INTO r VALUES ('T12 asset mismatch', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('T12 asset mismatch', true); END $$;

-- T13 not-yet-due candidate not claimable (grace honoured)
UPDATE public.mux_deletion_candidates SET eligible_at = clock_timestamp() + interval '1 hour' WHERE mux_asset_id='p4test_9';
INSERT INTO r SELECT 'T13 grace honoured', public.mux_cleanup_claim_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_9')) IS NULL;

-- T14 claimed asset cannot be re-attached (rescue raises video_unavailable)
DO $$ BEGIN
  PERFORM public.mux_rescue_attached_media('[{"provider":"mux","mux_upload_id":"p4test_none"}]'::jsonb); -- unresolvable: no-op
  INSERT INTO r VALUES ('T14 unresolved attach no-op', true);
END $$;
-- (resolved re-attach of a claimed asset requires a synthetic mux_uploads row;
--  covered by Phase 3 T-barrier test, unchanged by Phase 4.)

-- T15 unknown outcome rejected (caller cannot choose state)
DO $$ BEGIN PERFORM public.mux_cleanup_finalize_live(gen_random_uuid(), (SELECT id FROM ids WHERE a='p4test_3'), gen_random_uuid(), 'deleted_please');
  INSERT INTO r VALUES ('T15 unknown outcome', false);
EXCEPTION WHEN invalid_parameter_value THEN INSERT INTO r VALUES ('T15 unknown outcome', true); END $$;

-- T16 72 historical protected rows untouched
INSERT INTO r SELECT 'T16 protected untouched', count(*) FILTER (WHERE is_destructively_claimed)=0
  FROM public.mux_deletion_candidates WHERE status='protected_ambiguous';

SELECT t, ok FROM r ORDER BY t;
ROLLBACK;
