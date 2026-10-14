-- Post video Phase 3 (atomic linking + lock order) tests. One statement; ends
-- with RAISE so every fixture is rolled back — the error message is the report.
-- Made-up Mux details only; nothing is sent to Mux. Author = Hana (test account).
-- NOT covered (blocked: single-connection SQL tool): true simultaneous
-- save-vs-reconcile and save-vs-webhook races / deadlock absence.
DO $test$
DECLARE
  U constant uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  P1 uuid; P3 uuid; P4 uuid; P5 uuid; P6 uuid; MID uuid;
  res text := ''; ok int := 0; bad int := 0;
  j jsonb; j2 jsonb; v text; n int; n2 int; err text;
  photo jsonb := '{"type":"image","url":"https://example.com/p.jpg","order":0}';
  base jsonb := '{"type":"video","provider":"mux","url":"","caption":"","order":0}';
BEGIN
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at, asset_id, playback_id, duration, aspect_ratio)
  VALUES (U,'p3_a','ready',true,now()+interval '1h','A_A','PB_A',8,'9:16'),
         (U,'p3_b','ready',true,now()+interval '1h','A_B','PB_B',8,'9:16'),
         (U,'p3_c','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL),
         (U,'p3_d','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL),
         (U,'p3_e','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL),
         (U,'p3_f','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL);

  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';

  -- T1 create conflict on a second Post rolls back completely
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p3_one','c','experience','public', jsonb_build_array(base || '{"mux_upload_id":"p3_a"}')) RETURNING id INTO P1;
  err := NULL;
  BEGIN
    INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
    VALUES (U,'p3_conflict','c','experience','public', jsonb_build_array(base || '{"mux_upload_id":"p3_a"}'));
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  EXECUTE 'reset role';
  SELECT count(*) INTO n FROM public.posts WHERE title='p3_conflict' AND user_id=U;
  SELECT count(*) INTO n2 FROM public.mux_upload_mappings WHERE mux_upload_id='p3_a';
  IF err IN ('post_video_in_use','post_video_already_linked_elsewhere') AND n=0 AND n2=1
     AND EXISTS (SELECT 1 FROM public.mux_upload_mappings WHERE mux_upload_id='p3_a' AND content_id=P1) THEN
    ok:=ok+1; res:=res||E'\nPASS create conflict refused ('||err||'); no second Post, original mapping kept';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL create conflict err=%s posts=%s maps=%s', err, n, n2); END IF;
  EXECUTE 'set local role authenticated';

  -- T2 edit conflict leaves the existing Post and mappings unchanged
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p3_three','c','experience','public', jsonb_build_array(base || '{"mux_upload_id":"p3_b"}')) RETURNING id INTO P3;
  EXECUTE 'reset role';
  SELECT media INTO j FROM public.posts WHERE id=P3;
  SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) INTO j2 FROM public.mux_upload_mappings m WHERE content_type='post' AND content_id IN (P1,P3);
  EXECUTE 'set local role authenticated';
  err := NULL;
  BEGIN
    UPDATE public.posts SET media = jsonb_build_array(base || '{"mux_upload_id":"p3_a"}') WHERE id=P3;
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  EXECUTE 'reset role';
  IF err IN ('post_video_in_use','post_video_already_linked_elsewhere')
     AND (SELECT media FROM public.posts WHERE id=P3) = j
     AND (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public.mux_upload_mappings m WHERE content_type='post' AND content_id IN (P1,P3)) = j2 THEN
    ok:=ok+1; res:=res||E'\nPASS edit conflict refused ('||err||'); Post media and all mappings unchanged';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL edit conflict err=%s', err); END IF;

  -- T2b video removed from P1 (mapping kept as removed) then added to P3:
  -- earlier guard allows it, required mapping cannot be created -> new atomic error, full rollback
  EXECUTE 'set local role authenticated';
  UPDATE public.posts SET media = jsonb_build_array(photo) WHERE id=P1;
  EXECUTE 'reset role';
  SELECT media INTO j FROM public.posts WHERE id=P3;
  SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) INTO j2 FROM public.mux_upload_mappings m WHERE content_type='post' AND content_id IN (P1,P3);
  EXECUTE 'set local role authenticated';
  err := NULL;
  BEGIN
    UPDATE public.posts SET media = jsonb_build_array(base || '{"mux_upload_id":"p3_a"}') WHERE id=P3;
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  EXECUTE 'reset role';
  IF err = 'post_video_already_linked_elsewhere'
     AND (SELECT media FROM public.posts WHERE id=P3) = j
     AND (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public.mux_upload_mappings m WHERE content_type='post' AND content_id IN (P1,P3)) = j2 THEN
    ok:=ok+1; res:=res||E'\nPASS mapping-insert conflict on edit: whole save rolled back, Post and mappings unchanged';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL mapping-insert conflict err=%s', err); END IF;
  EXECUTE 'set local role authenticated';

  -- T3 save -> reconcile -> save follows persisted media
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p3_four','c','experience','public', jsonb_build_array(base || '{"mux_upload_id":"p3_c"}')) RETURNING id INTO P4;
  EXECUTE 'reset role';
  PERFORM public.reconcile_post_mux_mappings(P4);
  EXECUTE 'set local role authenticated';
  UPDATE public.posts SET media = jsonb_build_array(base || '{"mux_upload_id":"p3_d"}') WHERE id=P4;
  EXECUTE 'reset role';
  PERFORM public.reconcile_post_mux_mappings(P4);
  SELECT string_agg(mux_upload_id||':'||status||':'||media_index, ',' ORDER BY mux_upload_id) INTO v
    FROM public.mux_upload_mappings WHERE content_type='post' AND content_id=P4;
  IF v = 'p3_c:removed:0,p3_d:pending:0' THEN
    ok:=ok+1; res:=res||E'\nPASS save/reconcile/save: removed video stays removed, new video linked once';
  ELSE bad:=bad+1; res:=res||E'\nFAIL save/reconcile/save '||coalesce(v,'none'); END IF;

  -- T4 hard delete -> reconcile keeps mappings removed
  DELETE FROM public.posts WHERE id=P4;
  SELECT public.reconcile_post_mux_mappings(P4) ->> 'post' INTO err;
  SELECT count(*) INTO n FROM public.mux_upload_mappings WHERE content_type='post' AND content_id=P4 AND status<>'removed';
  IF err='missing' AND n=0 THEN ok:=ok+1; res:=res||E'\nPASS hard delete then reconcile: all mappings removed';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL hard delete reconcile post=%s active=%s', err, n); END IF;

  -- T5 webhook patch, then save
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p3_five','c','experience','public', jsonb_build_array(base || '{"mux_upload_id":"p3_e"}')) RETURNING id INTO P5;
  EXECUTE 'reset role';
  UPDATE public.mux_uploads SET status='ready', asset_id='A_E', playback_id='PB_E', duration=8, aspect_ratio='9:16' WHERE upload_id='p3_e';
  SELECT id INTO MID FROM public.mux_upload_mappings WHERE mux_upload_id='p3_e';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v := public.patch_content_media_from_mux(MID);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  UPDATE public.posts SET title='p3_five_b',
    media = jsonb_build_array((SELECT media->0 FROM public.posts WHERE id=P5) || '{"mux_playback_id":"FORGED"}') WHERE id=P5;
  EXECUTE 'reset role';
  SELECT media->0 INTO j FROM public.posts WHERE id=P5;
  SELECT count(*) INTO n FROM public.mux_upload_mappings WHERE mux_upload_id='p3_e';
  IF v='patched' AND j->>'mux_status'='ready' AND j->>'mux_playback_id'='PB_E' AND n=1
     AND (SELECT status FROM public.mux_upload_mappings WHERE id=MID)='patched' THEN
    ok:=ok+1; res:=res||E'\nPASS webhook then save: trusted media kept, mapping patched once';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL webhook then save patch=%s item=%s maps=%s', v, j, n); END IF;

  -- T6 save removes video, then late webhook is noop_removed
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p3_six','c','experience','public', jsonb_build_array(base || '{"mux_upload_id":"p3_f"}')) RETURNING id INTO P6;
  UPDATE public.posts SET media = jsonb_build_array(photo) WHERE id=P6;
  EXECUTE 'reset role';
  SELECT media INTO j FROM public.posts WHERE id=P6;
  UPDATE public.mux_uploads SET status='ready', asset_id='A_F', playback_id='PB_F', duration=8 WHERE upload_id='p3_f';
  SELECT id INTO MID FROM public.mux_upload_mappings WHERE mux_upload_id='p3_f';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v := public.patch_content_media_from_mux(MID);
  IF v='noop_removed' AND (SELECT media FROM public.posts WHERE id=P6) = j THEN
    ok:=ok+1; res:=res||E'\nPASS late webhook after removal: noop_removed, Post unchanged';
  ELSE bad:=bad+1; res:=res||E'\nFAIL late webhook '||coalesce(v,'null'); END IF;

  -- T7 helper permissions stay server-only
  SELECT string_agg(f, ',') INTO v FROM unnest(ARRAY['sync_mux_post_mappings_core(uuid,jsonb,boolean)','sync_mux_post_mappings(uuid,jsonb)',
      'reconcile_post_mux_mappings(uuid)','post_mux_link_items(uuid,jsonb)']) f
   WHERE has_function_privilege('authenticated', 'public.'||f, 'execute') OR has_function_privilege('anon', 'public.'||f, 'execute')
      OR NOT has_function_privilege('service_role', 'public.'||f, 'execute');
  IF v IS NULL THEN ok:=ok+1; res:=res||E'\nPASS helpers executable by service role only';
  ELSE bad:=bad+1; res:=res||E'\nFAIL helper grants '||v; END IF;

  res := res||E'\nBLOCKED simultaneous save-vs-reconcile / save-vs-webhook race (single connection)';
  RAISE EXCEPTION 'POST_VIDEO_PHASE3 % passed, % failed%', ok, bad, res;
END $test$;
