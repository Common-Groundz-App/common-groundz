-- Production-safe, single-statement verification. Synthetic Mux IDs only;
-- deliberate final exception rolls back ALL fixtures and reconciliation effects.
-- No worker call, HTTP request, deletion, trigger override or live-control change.
DO $test$
DECLARE
  uid uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  prefix text := 'silent_test_' || gen_random_uuid()::text;
  k text; up text; a text; post_id uuid; candidate_before jsonb;
  protected_before jsonb; control_before jsonb; cron_before jsonb;
  result text := ''; run_id uuid;
BEGIN
  PERFORM set_config('lock_timeout','3s',true);
  PERFORM set_config('statement_timeout','30s',true);
  SELECT jsonb_agg(to_jsonb(c) ORDER BY id) INTO protected_before
    FROM public.mux_deletion_candidates c WHERE status='protected_ambiguous';
  SELECT jsonb_agg(to_jsonb(c) ORDER BY id) INTO control_before FROM public.mux_cleanup_live_control c;
  SELECT jsonb_agg(jsonb_build_object('jobid',jobid,'schedule',schedule,'active',active)) INTO cron_before
    FROM cron.job WHERE jobname='mux-cleanup-live-hourly';

  -- A trusted unsaved fixture for every supported composer kind, aged past TTL.
  FOREACH k IN ARRAY ARRAY['post','review','review_update'] LOOP
    INSERT INTO public.mux_uploads(user_id,upload_id,asset_id,playback_id,status,is_test,kind,created_at,expires_at,duration)
    VALUES(uid,prefix||k,prefix||k||'_asset',prefix||k||'_play','ready',false,k,
           clock_timestamp()-interval '3 hours',clock_timestamp()-interval '2 hours',8);
  END LOOP;
  -- Too young and legacy unknown-kind must not qualify.
  INSERT INTO public.mux_uploads(user_id,upload_id,asset_id,status,is_test,kind,created_at,expires_at)
    VALUES(uid,prefix||'young',prefix||'young_asset','ready',false,'post',clock_timestamp(),clock_timestamp()),
          (uid,prefix||'legacy',prefix||'legacy_asset','ready',false,NULL,clock_timestamp()-interval '3 hours',clock_timestamp()-interval '2 hours');

  -- Saved-reference fixture through the real Post save/mapping triggers.
  INSERT INTO public.mux_uploads(user_id,upload_id,asset_id,playback_id,status,is_test,kind,created_at,expires_at,duration)
    VALUES(uid,prefix||'saved',prefix||'saved_asset',prefix||'saved_play','ready',false,'post',
           clock_timestamp()-interval '3 hours',clock_timestamp()-interval '2 hours',8);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
    VALUES(uid,prefix,'rollback-only fixture','experience','public',jsonb_build_array(jsonb_build_object(
      'type','video','provider','mux','url','','order',0,'mux_upload_id',prefix||'saved')))
    RETURNING id INTO post_id;
  IF NOT public.mux_upload_saved_reference(prefix||'saved',prefix||'saved_asset') THEN
    RAISE EXCEPTION 'FAIL saved fixture has no real saved reference';
  END IF;

  -- Explicit marker with asset/no candidate: silent must not reclassify it.
  INSERT INTO public.mux_uploads(user_id,upload_id,asset_id,status,is_test,kind,created_at,expires_at,is_abandoned,abandonment_reason)
    VALUES(uid,prefix||'explicit',prefix||'explicit_asset','ready',false,'post',
           clock_timestamp()-interval '3 hours',clock_timestamp()-interval '2 hours',true,'composer_discarded');
  PERFORM public.mux_reconcile_silently_abandoned_uploads(100);
  FOREACH k IN ARRAY ARRAY['post','review','review_update'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.mux_uploads WHERE upload_id=prefix||k
                   AND is_abandoned AND abandonment_reason='silent_abandonment')
       OR NOT EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE mux_asset_id=prefix||k||'_asset'
                      AND enqueue_reason='silent_abandonment' AND status='pending_grace'
                      AND eligible_at-discovered_at BETWEEN interval '24 hours' AND interval '24 hours 1 second') THEN
      RAISE EXCEPTION 'FAIL TTL/queue/grace for %',k;
    END IF;
  END LOOP;
  result := result || E'\nPASS trusted post/review/review_update beyond TTL -> silent_abandonment + 24h pending_grace';
  IF EXISTS (SELECT 1 FROM public.mux_uploads WHERE upload_id IN (prefix||'young',prefix||'legacy',prefix||'saved') AND is_abandoned)
     OR EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE mux_asset_id IN (prefix||'young_asset',prefix||'legacy_asset',prefix||'saved_asset')) THEN
    RAISE EXCEPTION 'FAIL saved/young/legacy skipped';
  END IF;
  result := result || E'\nPASS saved references, younger uploads and unknown historical kind skipped';
  IF (SELECT abandonment_reason FROM public.mux_uploads WHERE upload_id=prefix||'explicit') IS DISTINCT FROM 'composer_discarded'
     OR EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE mux_asset_id=prefix||'explicit_asset') THEN
    RAISE EXCEPTION 'FAIL explicit marker was reclassified';
  END IF;
  result := result || E'\nPASS explicit abandonment remains separate';

  SELECT to_jsonb(c) INTO candidate_before FROM public.mux_deletion_candidates c WHERE mux_asset_id=prefix||'review_asset';
  PERFORM public.mux_reconcile_silently_abandoned_uploads(100);
  IF (SELECT to_jsonb(c) FROM public.mux_deletion_candidates c WHERE mux_asset_id=prefix||'review_asset') IS DISTINCT FROM candidate_before THEN
    RAISE EXCEPTION 'FAIL duplicate run changed candidate/grace';
  END IF;
  result := result || E'\nPASS duplicate runs idempotent (whole candidate unchanged)';

  -- Attach the silently queued Post upload through real save triggers.
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
    VALUES(uid,prefix||'_rescue','rollback-only rescue','experience','public',jsonb_build_array(jsonb_build_object(
      'type','video','provider','mux','url','','order',0,'mux_upload_id',prefix||'post')));
  IF NOT EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE mux_asset_id=prefix||'post_asset' AND status='rescued_referenced')
     OR EXISTS (SELECT 1 FROM public.mux_uploads WHERE upload_id=prefix||'post' AND (is_abandoned OR abandonment_reason IS NOT NULL)) THEN
    RAISE EXCEPTION 'FAIL real saved-attachment rescue';
  END IF;
  result := result || E'\nPASS real Post attachment rescues candidate and clears abandoned marker';

  -- Existing run-start path reaches both reconcilers without calling the worker.
  SELECT public.mux_live_run_start(gen_random_uuid(),'admin') INTO run_id;
  IF NOT EXISTS (SELECT 1 FROM public.mux_cleanup_live_runs WHERE id=run_id)
     OR NOT EXISTS (SELECT 1 FROM public.mux_deletion_candidates WHERE mux_asset_id=prefix||'explicit_asset' AND enqueue_reason='composer_discarded') THEN
    RAISE EXCEPTION 'FAIL run-start/explicit reconciliation';
  END IF;
  result := result || E'\nPASS existing run-start integration preserves explicit reason';

  IF (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.mux_deletion_candidates c WHERE status='protected_ambiguous') IS DISTINCT FROM protected_before
     OR jsonb_array_length(protected_before) <> 72 THEN RAISE EXCEPTION 'FAIL historical 72 changed'; END IF;
  IF (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.mux_cleanup_live_control c) IS DISTINCT FROM control_before
     OR (SELECT jsonb_agg(jsonb_build_object('jobid',jobid,'schedule',schedule,'active',active)) FROM cron.job WHERE jobname='mux-cleanup-live-hourly') IS DISTINCT FROM cron_before THEN
    RAISE EXCEPTION 'FAIL control/cron changed';
  END IF;
  result := result || E'\nPASS all 72 protected rows byte-equivalent; live control and hourly cron unchanged';
  RAISE EXCEPTION USING MESSAGE='VERIFICATION PASSED — intentional full rollback:'||result, ERRCODE='P0001';
END $test$;