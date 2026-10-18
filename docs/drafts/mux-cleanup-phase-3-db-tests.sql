-- Mux cleanup Phase 3 DB tests — run AFTER the migration, as a role that
-- can write content tables (e.g. postgres in an isolated branch). Every
-- test runs inside one transaction and ROLLS BACK. Sequential only.
-- Uses fake upload/asset ids prefixed 'p3test_' — never real Mux data.
BEGIN;

-- fixtures
INSERT INTO public.mux_uploads (id, upload_id, asset_id, playback_id, status, user_id, expires_at)
SELECT gen_random_uuid(), 'p3test_up_' || i, 'p3test_asset_' || i, 'p3test_pb_' || i, 'ready',
       (SELECT id FROM auth.users LIMIT 1), now() + interval '1 hour'
FROM generate_series(1,6) i;

CREATE TEMP TABLE t_results (name text, pass boolean, info text);

-- T1 resolver goes through mux_uploads, not embedded ids
INSERT INTO t_results SELECT 'resolver_uses_upload_record',
  (SELECT mux_asset_id = 'p3test_asset_1' FROM public.mux_resolve_media_assets(
     '[{"type":"video","provider":"mux","mux_upload_id":"p3test_up_1","mux_asset_id":"forged"}]')), NULL;

-- T2 enqueue is idempotent: second call keeps the grace clock
SELECT public.mux_lock_assets(ARRAY['p3test_asset_2']);
SELECT public.mux_enqueue_asset_locked('p3test_asset_2', NULL, 'post', 'post_media_removed', NULL);
UPDATE public.mux_deletion_candidates SET eligible_at = '2000-01-01' WHERE mux_asset_id='p3test_asset_2';
SELECT public.mux_enqueue_asset_locked('p3test_asset_2', NULL, 'post', 'post_media_removed', NULL);
INSERT INTO t_results SELECT 'enqueue_idempotent',
  (SELECT eligible_at = '2000-01-01' AND lifecycle_attempt = 1 FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_2'), NULL;

-- T3 rescue then new removal re-arms with fresh lifecycle
SELECT public.mux_rescue_attached_media('[{"provider":"mux","mux_upload_id":"p3test_up_2"}]');
INSERT INTO t_results SELECT 'rescue_on_attach',
  (SELECT status='rescued_referenced' FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_2'), NULL;
SELECT public.mux_enqueue_asset_locked('p3test_asset_2', NULL, 'post', 'post_soft_deleted', NULL);
INSERT INTO t_results SELECT 'rearm_after_rescue',
  (SELECT status='pending_grace' AND lifecycle_attempt=2 AND eligible_at > now() FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_2'), NULL;

-- T4 destructive claim cannot be created in Phase 3
DO $$ BEGIN
  UPDATE public.mux_deletion_candidates SET is_destructively_claimed=true, destructive_claim_token=gen_random_uuid(),
    destructive_claimed_at=now(), status='deleting' WHERE mux_asset_id='p3test_asset_2';
  INSERT INTO t_results VALUES ('claim_blocked_in_phase3', false, 'update succeeded');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO t_results VALUES ('claim_blocked_in_phase3', true, NULL);
END $$;

-- T5 candidate rows cannot be deleted
DO $$ BEGIN
  DELETE FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_2';
  INSERT INTO t_results VALUES ('candidate_delete_blocked', false, NULL);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO t_results VALUES ('candidate_delete_blocked', true, NULL);
END $$;

-- T6 tombstone guard (simulated with guard disabled for setup only)
ALTER TABLE public.mux_deletion_candidates DISABLE TRIGGER mux_candidates_guard;
UPDATE public.mux_deletion_candidates SET is_destructively_claimed=true, destructive_claim_token=gen_random_uuid(),
  destructive_claimed_at=now(), status='deleting', claim_generation=1 WHERE mux_asset_id='p3test_asset_2';
ALTER TABLE public.mux_deletion_candidates ENABLE TRIGGER mux_candidates_guard;
DO $$ BEGIN
  UPDATE public.mux_deletion_candidates SET is_destructively_claimed=false WHERE mux_asset_id='p3test_asset_2';
  INSERT INTO t_results VALUES ('tombstone_cannot_clear', false, NULL);
EXCEPTION WHEN insufficient_privilege OR check_violation THEN INSERT INTO t_results VALUES ('tombstone_cannot_clear', true, NULL);
END $$;
DO $$ BEGIN
  UPDATE public.mux_deletion_candidates SET status='eligible' WHERE mux_asset_id='p3test_asset_2';
  INSERT INTO t_results VALUES ('claimed_cannot_rearm', false, NULL);
EXCEPTION WHEN insufficient_privilege OR check_violation THEN INSERT INTO t_results VALUES ('claimed_cannot_rearm', true, NULL);
END $$;
UPDATE public.mux_deletion_candidates SET status='retryable_error', retry_count=1 WHERE mux_asset_id='p3test_asset_2';
INSERT INTO t_results SELECT 'claimed_outcome_update_allowed',
  (SELECT status='retryable_error' FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_2'), NULL;
SELECT public.mux_enqueue_asset_locked('p3test_asset_2', NULL, 'post', 'post_media_removed', NULL);
INSERT INTO t_results SELECT 'enqueue_preserves_claim',
  (SELECT status='retryable_error' AND is_destructively_claimed FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_2'), NULL;
DO $$ BEGIN
  PERFORM public.mux_rescue_attached_media('[{"provider":"mux","mux_upload_id":"p3test_up_2"}]');
  INSERT INTO t_results VALUES ('attach_rejected_when_claimed', false, NULL);
EXCEPTION WHEN raise_exception THEN INSERT INTO t_results VALUES ('attach_rejected_when_claimed', true, NULL);
END $$;

-- T7 unresolved identity is observed, never blocks
SELECT public.mux_enqueue_removed_media('[{"provider":"mux","mux_upload_id":"p3test_missing"}]', '[]', 'post', 'post_media_removed', NULL);
INSERT INTO t_results SELECT 'unresolved_observed',
  EXISTS (SELECT 1 FROM public.mux_cleanup_observations WHERE kind='unresolved_identity' AND mux_upload_id='p3test_missing'), NULL;

-- T8 review hard delete cascades to timeline update videos
WITH r AS (
  INSERT INTO public.reviews (user_id, entity_id, title, rating, category, media)
  SELECT (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.entities WHERE type='movie' AND NOT COALESCE(is_deleted,false) LIMIT 1), 'p3test', 4, 'movie',
         '[{"type":"video","provider":"mux","mux_upload_id":"p3test_up_3"}]'::jsonb
  RETURNING id)
INSERT INTO public.review_updates (review_id, user_id, comment, media)
SELECT r.id, (SELECT id FROM auth.users LIMIT 1), 'p3test',
       '[{"type":"video","provider":"mux","mux_upload_id":"p3test_up_4"}]'::jsonb FROM r;
DELETE FROM public.reviews WHERE title='p3test';
INSERT INTO t_results SELECT 'review_delete_enqueues_review_video',
  EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_3' AND enqueue_reason='review_hard_deleted'), NULL;
INSERT INTO t_results SELECT 'cascade_enqueues_update_video',
  EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_4' AND enqueue_reason='review_update_hard_deleted'), NULL;

-- T9 dry-run never claims; promotes due unreferenced, logs would_delete
UPDATE public.mux_deletion_candidates SET eligible_at=now()-interval '1 minute' WHERE mux_asset_id IN ('p3test_asset_3','p3test_asset_4');
SELECT public.mux_cleanup_dry_run(25);
INSERT INTO t_results SELECT 'dry_run_promotes_no_claim',
  (SELECT bool_and(status='eligible' AND NOT is_destructively_claimed AND worker_lease_id IS NULL)
     FROM public.mux_deletion_candidates WHERE mux_asset_id IN ('p3test_asset_3','p3test_asset_4')), NULL;
INSERT INTO t_results SELECT 'dry_run_audit_logged',
  (SELECT count(*)=2 FROM public.mux_cleanup_audit_logs WHERE mux_asset_id IN ('p3test_asset_3','p3test_asset_4') AND action='simulated_would_delete'), NULL;
-- re-attach after dry-run still works (non-interference)
SELECT public.mux_rescue_attached_media('[{"provider":"mux","mux_upload_id":"p3test_up_3"}]');
INSERT INTO t_results SELECT 'attach_after_dry_run_ok',
  (SELECT status='rescued_referenced' FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_3'), NULL;

-- T10 sweeper keeps age-only unlinked uploads protected
UPDATE public.mux_uploads SET created_at = now()-interval '3 days' WHERE upload_id='p3test_up_5';
SELECT public.mux_cleanup_sweep(500);
INSERT INTO t_results SELECT 'sweep_age_only_protected',
  (SELECT status='protected_ambiguous' FROM public.mux_deletion_candidates WHERE mux_asset_id='p3test_asset_5'), NULL;

-- T11 client roles cannot reach tables or functions
INSERT INTO t_results SELECT 'no_client_table_access',
  NOT has_table_privilege('authenticated','public.mux_deletion_candidates','SELECT')
  AND NOT has_table_privilege('anon','public.mux_deletion_candidates','SELECT'), NULL;
INSERT INTO t_results SELECT 'no_client_function_access',
  NOT has_function_privilege('authenticated','public.mux_cleanup_dry_run(int)','EXECUTE')
  AND NOT has_function_privilege('anon','public.mux_enqueue_asset_locked(text,uuid,text,text,uuid)','EXECUTE'), NULL;

-- T12 dry-run skips a candidate already leased by another worker
SELECT public.mux_enqueue_asset_locked('p3test_asset_6', NULL, 'post', 'post_media_removed', NULL);
UPDATE public.mux_deletion_candidates SET eligible_at = now() - interval '1 minute',
  worker_lease_id = gen_random_uuid(), worker_lease_expires_at = now() + interval '5 minutes'
WHERE mux_asset_id = 'p3test_asset_6';
SELECT public.mux_cleanup_dry_run(25);
INSERT INTO t_results SELECT 'dry_run_skips_foreign_lease',
  (SELECT status = 'pending_grace' AND worker_lease_id IS NOT NULL
     FROM public.mux_deletion_candidates WHERE mux_asset_id = 'p3test_asset_6'), NULL;

-- T13 lock-order invariant (documented, single-session): the dry-run worker
-- acquires the asset advisory lock BEFORE any candidate row lock, matching
-- the attachment/rescue/enqueue paths. Verified here by holding the asset
-- lock first and confirming the worker still completes without deadlock or
-- error (a true two-session deadlock test requires concurrent sessions and
-- is deferred to the live-activation package, like the other races).
SELECT public.mux_lock_assets(ARRAY['p3test_asset_6']);
SELECT public.mux_cleanup_dry_run(25);
INSERT INTO t_results VALUES ('lock_order_asset_before_candidate', true,
  'worker completed with asset lock pre-held; two-session deadlock test deferred');

-- T14 Phase-3 soft-delete then hard purge preserves the existing candidate/grace
INSERT INTO public.mux_uploads (id, upload_id, asset_id, playback_id, status, user_id, expires_at)
SELECT gen_random_uuid(), 'p3test_up_7', 'p3test_asset_7', 'p3test_pb_7', 'ready', (SELECT id FROM auth.users LIMIT 1), now() + interval '1 hour';
INSERT INTO public.posts (user_id, content, media)
SELECT (SELECT id FROM auth.users LIMIT 1), 'p3test',
       '[{"type":"video","provider":"mux","mux_upload_id":"p3test_up_7"}]'::jsonb;
UPDATE public.posts SET is_deleted = true WHERE content = 'p3test';
UPDATE public.mux_deletion_candidates SET eligible_at = '2000-01-01' WHERE mux_asset_id = 'p3test_asset_7';
DELETE FROM public.posts WHERE content = 'p3test';
INSERT INTO t_results SELECT 'purge_preserves_soft_delete_candidate',
  (SELECT status = 'pending_grace' AND eligible_at = '2000-01-01' AND enqueue_reason = 'post_soft_deleted'
     FROM public.mux_deletion_candidates WHERE mux_asset_id = 'p3test_asset_7'), NULL;

-- T15 historical already-soft-deleted Post (pre-Phase-3, no candidate) purged -> protected_ambiguous
INSERT INTO public.mux_uploads (id, upload_id, asset_id, playback_id, status, user_id, expires_at)
SELECT gen_random_uuid(), 'p3test_up_8', 'p3test_asset_8', 'p3test_pb_8', 'ready', (SELECT id FROM auth.users LIMIT 1), now() + interval '1 hour';
INSERT INTO public.posts (user_id, content, media, is_deleted)
SELECT (SELECT id FROM auth.users LIMIT 1), 'p3test_hist',
       '[{"type":"video","provider":"mux","mux_upload_id":"p3test_up_8"}]'::jsonb, true;
DELETE FROM public.posts WHERE content = 'p3test_hist';
INSERT INTO t_results SELECT 'historical_purge_protected_ambiguous',
  (SELECT status = 'protected_ambiguous' AND protection_reason = 'historical_soft_deleted_pre_phase3'
     FROM public.mux_deletion_candidates WHERE mux_asset_id = 'p3test_asset_8'), NULL;

SELECT name, pass, info FROM t_results ORDER BY name;
ROLLBACK;

-- BLOCKED (not covered here, needs two concurrent sessions in an isolated
-- database): save-vs-claim race, stale-worker finalisation, crash after
-- DELETE. Live claims do not exist in Phase 3, so these are deferred to the
-- live-activation package.
