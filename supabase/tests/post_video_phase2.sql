-- Post video Phase 2 server-rule tests. One statement; ends with RAISE so every
-- fixture is rolled back — the error message is the report.
-- Updated for Phase 3: saves create links automatically; P2 uses its own uploads
-- because a removed upload cannot be relinked to a different Post. Made-up Mux
-- details only; nothing is sent to Mux. Author = Hana (test account).
DO $test$
DECLARE
  U  constant uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  O  constant uuid := 'c82c9b24-d832-460b-9a3d-97299e92f4ed';
  P uuid; P2 uuid; PH uuid; PO uuid; M uuid;
  res text := ''; ok int := 0; bad int := 0;
  j jsonb; j2 jsonb; v text; b boolean; r text;
  photo  jsonb := '{"type":"image","url":"https://example.com/p.jpg","order":0}';
  photo2 jsonb := '{"type":"image","url":"https://example.com/p2.jpg","order":2}';
  createv jsonb;
BEGIN
  -- fixtures (owner context)
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at, asset_id, playback_id, duration, aspect_ratio)
  VALUES (U,'pp_new','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL),
         (U,'pp_ready','ready',true,now()+interval '1h','A_READY','PB_READY',8,'9:16'),
         (U,'pp_long','ready',true,now()+interval '1h','A_LONG','PB_LONG',75,'16:9'),
         (U,'pp_fail','errored',true,now()+interval '1h','A_FAIL',NULL,NULL,NULL),
         (U,'pp_late','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL),
         (U,'pp_b','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL),
         (O,'pp_other','ready',true,now()+interval '1h','A_O','PB_O',5,NULL),
         (U,'pp_flag','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL),
         (U,'pp_new2','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL),
         (U,'pp_b2','waiting',true,now()+interval '1h',NULL,NULL,NULL,NULL);
  -- an "old" (pre-rule) long upload
  ALTER TABLE public.mux_uploads DISABLE TRIGGER mux_uploads_duration_rule_guard;
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at, asset_id, playback_id, duration, duration_rule_applies)
  VALUES (U,'pp_oldlong','ready',true,now()+interval '1h','A_OL','PB_OL',90,false),
         (U,'pp_hist','ready',true,now()+interval '1h','A_H','PB_H',8,false);
  ALTER TABLE public.mux_uploads ENABLE TRIGGER mux_uploads_duration_rule_guard;

  -- T1 eligibility flag: set at insert, immutable
  UPDATE public.mux_uploads SET duration_rule_applies = false WHERE upload_id = 'pp_flag';
  SELECT duration_rule_applies INTO b FROM public.mux_uploads WHERE upload_id='pp_flag';
  IF b THEN ok:=ok+1; res:=res||E'\nPASS eligibility flag set on insert and cannot be turned off';
  ELSE bad:=bad+1; res:=res||E'\nFAIL eligibility flag changed'; END IF;
  UPDATE public.mux_uploads SET duration_rule_applies = true WHERE upload_id = 'pp_oldlong';
  SELECT duration_rule_applies INTO b FROM public.mux_uploads WHERE upload_id='pp_oldlong';
  IF NOT b THEN ok:=ok+1; res:=res||E'\nPASS old upload cannot be made eligible';
  ELSE bad:=bad+1; res:=res||E'\nFAIL old upload became eligible'; END IF;

  -- T2 trigger order (BEFORE triggers fire alphabetically)
  SELECT string_agg(tgname, ',' ORDER BY tgname) INTO v FROM pg_trigger
   WHERE tgrelid='public.posts'::regclass AND NOT tgisinternal AND (tgtype & 2) = 2;
  IF v LIKE '%enforce_post_edit_window_trigger%media_guard%zz_posts_media_mux_before' THEN
    ok:=ok+1; res:=res||E'\nPASS trigger order: '||v;
  ELSE bad:=bad+1; res:=res||E'\nFAIL trigger order: '||v; END IF;

  -- signed-in author context
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';

  -- T3 exact /create payload saves; server rebuilds, no playable fields
  createv := jsonb_build_object('id','11111111-1111-1111-1111-111111111111','url','https://example.com/storage/poster.jpg',
    'thumbnail_url','https://example.com/storage/poster.jpg','type','video','caption','','alt','clip','order',0,
    'session_id','s1','width',720,'height',1280,'duration',8,'orientation','portrait',
    'provider','mux','mux_upload_id','pp_new','mux_status','preparing');
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'pp','c','experience','public', jsonb_build_array(createv)) RETURNING id INTO P;
  SELECT media->0 INTO j FROM public.posts WHERE id=P;
  IF j->>'mux_status'='preparing' AND j->>'url'='' AND NOT j ? 'thumbnail_url' AND NOT j ? 'mux_playback_id'
     AND j->>'caption'='' AND j->>'session_id'='s1' AND j->>'width'='720' THEN
    ok:=ok+1; res:=res||E'\nPASS /create payload saves; processing keeps no poster/playable fields';
  ELSE bad:=bad+1; res:=res||E'\nFAIL /create payload '||j::text; END IF;

  -- T4 forged playback/ready/url/provider on a new video -> overwritten
  UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"pp_b","mux_status":"ready","mux_playback_id":"FORGED","url":"https://stream.mux.com/FORGED.m3u8","thumbnail_url":"https://evil/x.jpg","provider":"supabase","mux_asset_id":"FA","aspect_ratio":"1:1"}'::jsonb) WHERE id=P;
  SELECT media->0 INTO j FROM public.posts WHERE id=P;
  IF j->>'mux_status'='preparing' AND j->>'provider'='mux' AND j->>'url'='' AND NOT j ? 'mux_playback_id'
     AND NOT j ? 'thumbnail_url' AND NOT j ? 'mux_asset_id' AND NOT j ? 'aspect_ratio' THEN
    ok:=ok+1; res:=res||E'\nPASS forged ready/playback/url/thumbnail/provider/asset on save are overwritten (processing)';
  ELSE bad:=bad+1; res:=res||E'\nFAIL forged save '||j::text; END IF;

  -- T5 ready upload -> trusted values
  UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"pp_ready","mux_playback_id":"FORGED"}'::jsonb) WHERE id=P;
  SELECT media->0 INTO j FROM public.posts WHERE id=P;
  IF j->>'mux_status'='ready' AND j->>'mux_playback_id'='PB_READY' AND j->>'mux_asset_id'='A_READY'
     AND j->>'url'='https://image.mux.com/PB_READY/thumbnail.jpg' AND j->>'thumbnail_url'=j->>'url'
     AND (j->>'duration')::numeric=8 AND j->>'aspect_ratio'='9:16' THEN
    ok:=ok+1; res:=res||E'\nPASS ready video gets trusted values from the upload record';
  ELSE bad:=bad+1; res:=res||E'\nFAIL ready rebuild '||j::text; END IF;

  -- T6 stale "preparing" sent after ready keeps ready
  UPDATE public.posts SET content='edit', media = jsonb_build_array(createv || '{"mux_upload_id":"pp_ready"}'::jsonb) WHERE id=P;
  SELECT media->0 INTO j FROM public.posts WHERE id=P;
  IF j->>'mux_status'='ready' AND j->>'mux_playback_id'='PB_READY' THEN
    ok:=ok+1; res:=res||E'\nPASS stale preparing payload keeps ready';
  ELSE bad:=bad+1; res:=res||E'\nFAIL stale '||j::text; END IF;

  -- T7 failed upload: stale playable fields removed
  UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"pp_fail","mux_playback_id":"X","url":"https://stream.mux.com/X.m3u8","thumbnail_url":"https://x/t.jpg"}'::jsonb) WHERE id=P;
  SELECT media->0 INTO j FROM public.posts WHERE id=P;
  IF j->>'mux_status'='errored' AND j->>'url'='' AND NOT j ? 'mux_playback_id' AND NOT j ? 'thumbnail_url' THEN
    ok:=ok+1; res:=res||E'\nPASS failed video: forged playback/url/thumbnail removed';
  ELSE bad:=bad+1; res:=res||E'\nFAIL failed '||j::text; END IF;

  -- T8 eligible >60s -> too_long, no playback
  UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"pp_long","mux_playback_id":"PB_LONG","url":"https://stream.mux.com/PB_LONG.m3u8"}'::jsonb) WHERE id=P;
  SELECT media->0 INTO j FROM public.posts WHERE id=P;
  IF j->>'mux_status'='errored' AND j->>'mux_error'='too_long' AND j->>'url'='' AND NOT j ? 'mux_playback_id' AND NOT j ? 'thumbnail_url' THEN
    ok:=ok+1; res:=res||E'\nPASS new video over 60 s becomes too long with no playable fields';
  ELSE bad:=bad+1; res:=res||E'\nFAIL too long '||j::text; END IF;

  -- T9 old ineligible >60s stays ready
  UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"pp_oldlong"}'::jsonb) WHERE id=P;
  SELECT media->0 INTO j FROM public.posts WHERE id=P;
  IF j->>'mux_status'='ready' AND j->>'mux_playback_id'='PB_OL' THEN
    ok:=ok+1; res:=res||E'\nPASS old (pre-rule) 90 s video stays ready';
  ELSE bad:=bad+1; res:=res||E'\nFAIL old long '||j::text; END IF;

  -- T10 someone else's upload refused
  BEGIN
    UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"pp_other"}'::jsonb) WHERE id=P;
    bad:=bad+1; res:=res||E'\nFAIL other user upload accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='post_video_not_owned' THEN ok:=ok+1; res:=res||E'\nPASS another user''s upload refused';
    ELSE bad:=bad+1; res:=res||E'\nFAIL other: '||SQLERRM; END IF;
  END;
  BEGIN
    UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"does_not_exist"}'::jsonb) WHERE id=P;
    bad:=bad+1; res:=res||E'\nFAIL unknown upload accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='post_video_not_owned' THEN ok:=ok+1; res:=res||E'\nPASS unknown upload refused';
    ELSE bad:=bad+1; res:=res||E'\nFAIL unknown: '||SQLERRM; END IF;
  END;

  -- T11 limits: 5 items / 2 videos refused on a normal post
  BEGIN
    UPDATE public.posts SET media = jsonb_build_array(photo,photo,photo,photo,photo) WHERE id=P;
    bad:=bad+1; res:=res||E'\nFAIL 5 items accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='post_media_too_many' THEN ok:=ok+1; res:=res||E'\nPASS 5th item refused';
    ELSE bad:=bad+1; res:=res||E'\nFAIL 5 items: '||SQLERRM; END IF;
  END;
  BEGIN
    UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"pp_ready"}'::jsonb, createv || '{"mux_upload_id":"pp_late"}'::jsonb) WHERE id=P;
    bad:=bad+1; res:=res||E'\nFAIL 2 videos accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='post_video_too_many' THEN ok:=ok+1; res:=res||E'\nPASS 2nd video refused';
    ELSE bad:=bad+1; res:=res||E'\nFAIL 2 videos: '||SQLERRM; END IF;
  END;

  -- grandfathered fixtures (inserted with the new rule switched off, as old data)
  EXECUTE 'reset role';
  ALTER TABLE public.posts DISABLE TRIGGER zz_posts_media_mux_before;
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'old5','c','experience','public', jsonb_build_array(photo,photo,photo,photo,photo)) RETURNING id INTO PO;
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'hist','c','experience','public', jsonb_build_array(photo,
     '{"type":"video","provider":"mux","url":"https://example.com/storage/hp.jpg","order":1,"mux_upload_id":"pp_hist","mux_status":"preparing"}'::jsonb,
     photo2,
     '{"type":"video","url":"https://example.com/storage/old.mp4","order":3}'::jsonb)) RETURNING id INTO PH;
  ALTER TABLE public.posts ENABLE TRIGGER zz_posts_media_mux_before;
  EXECUTE 'set local role authenticated';

  -- T12 over-limit old post: caption edit + removal pass, adding refused
  UPDATE public.posts SET content='caption only' WHERE id=PO;
  UPDATE public.posts SET media = jsonb_build_array(photo,photo,photo,photo,photo) WHERE id=PO; -- same media
  UPDATE public.posts SET media = jsonb_build_array(photo,photo,photo,photo) WHERE id=PO;
  SELECT jsonb_array_length(media) INTO v FROM public.posts WHERE id=PO;
  IF v='4' THEN ok:=ok+1; res:=res||E'\nPASS over-limit old post: caption edit and removal allowed';
  ELSE bad:=bad+1; res:=res||E'\nFAIL over-limit old post len '||v; END IF;

  -- T13 historical stuck post: caption edit untouched, not relinked
  SELECT media INTO j FROM public.posts WHERE id=PH;
  UPDATE public.posts SET content='caption only' WHERE id=PH;
  SELECT media INTO j2 FROM public.posts WHERE id=PH;
  EXECUTE 'reset role';
  SELECT count(*)::text INTO v FROM public.mux_upload_mappings WHERE content_id=PH;
  EXECUTE 'set local role authenticated';
  IF j2=j AND v='0' THEN ok:=ok+1; res:=res||E'\nPASS historical stuck post: caption edit keeps media byte-identical, no link created';
  ELSE bad:=bad+1; res:=res||E'\nFAIL historical caption '||v; END IF;

  -- T14 remove neighbouring photo: unchanged historical video kept by identity (still preparing, not repaired); old stored video untouched
  UPDATE public.posts SET media = jsonb_build_array(j->1 || '{"order":0}'::jsonb, j->2, j->3) WHERE id=PH;
  SELECT media INTO j2 FROM public.posts WHERE id=PH;
  EXECUTE 'reset role';
  SELECT count(*)::text INTO v FROM public.mux_upload_mappings WHERE content_id=PH;
  EXECUTE 'set local role authenticated';
  IF ((j2->0) - 'order') = ((j->1) - 'order') AND j2->0->>'mux_status'='preparing' AND j2->2 = j->3 AND v='0' THEN
    ok:=ok+1; res:=res||E'\nPASS photo removed beside historical video: video kept as-is (not repaired), stored-file video untouched, no link';
  ELSE bad:=bad+1; res:=res||E'\nFAIL neighbour removal '||j2::text; END IF;

  -- trusted Mux patch path
  -- set up: P has pp_late (processing) as slot 1 next to a photo
  UPDATE public.posts SET media = jsonb_build_array(photo, createv || '{"mux_upload_id":"pp_late","order":1}'::jsonb) WHERE id=P;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  -- Phase 3: the save above already created this link
  SELECT id INTO M FROM public.mux_upload_mappings WHERE mux_upload_id='pp_late' AND content_type='post' AND content_id=P AND status='pending';
  UPDATE public.mux_uploads SET status='ready', asset_id='A_LATE', playback_id='PB_LATE', duration=7, aspect_ratio='9:16' WHERE upload_id='pp_late';
  SELECT media INTO j FROM public.posts WHERE id=P;

  -- T15 forged trusted patches refused (each in its own subtransaction)
  PERFORM set_config('app.mux_system_patch','on',true);
  FOR r IN SELECT unnest(ARRAY['asset','thumb','duration','aspect','fake_failed','fake_toolong','other_item','add','remove','caption']) LOOP
    BEGIN
      j2 := j || '[]'::jsonb;
      j2 := jsonb_set(j2,'{1}', (j2->1) - 'url' || public.post_mux_truth_item(j->1, U));
      IF r='asset' THEN j2 := jsonb_set(j2,'{1,mux_asset_id}','"FORGED"');
      ELSIF r='thumb' THEN j2 := jsonb_set(j2,'{1,thumbnail_url}','"https://evil/t.jpg"');
      ELSIF r='duration' THEN j2 := jsonb_set(j2,'{1,duration}','3');
      ELSIF r='aspect' THEN j2 := jsonb_set(j2,'{1,aspect_ratio}','"1:1"');
      ELSIF r='fake_failed' THEN j2 := jsonb_set(j2,'{1}', public.post_mux_strip(j->1) || '{"provider":"mux","type":"video","url":"","mux_status":"errored","mux_error":"errored","mux_asset_id":"A_LATE"}'::jsonb);
      ELSIF r='fake_toolong' THEN j2 := jsonb_set(j2,'{1}', public.post_mux_strip(j->1) || '{"provider":"mux","type":"video","url":"","mux_status":"errored","mux_error":"too_long","duration":7,"mux_asset_id":"A_LATE"}'::jsonb);
      ELSIF r='other_item' THEN j2 := jsonb_set(j2,'{0,url}','"https://example.com/changed.jpg"');
      ELSIF r='add' THEN j2 := j2 || jsonb_build_array(photo2);
      ELSIF r='remove' THEN j2 := jsonb_build_array(j2->1);
      END IF;
      IF r='caption' THEN
        UPDATE public.posts SET content='sneaky', media = j2 WHERE id=P;
      ELSE
        UPDATE public.posts SET media = j2 WHERE id=P;
      END IF;
      bad:=bad+1; res:=res||E'\nFAIL trusted patch accepted: '||r;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM='mux_patch_invalid' THEN ok:=ok+1; res:=res||E'\nPASS trusted patch refused: '||r;
      ELSE bad:=bad+1; res:=res||E'\nFAIL trusted '||r||': '||SQLERRM; END IF;
    END;
  END LOOP;
  PERFORM set_config('app.mux_system_patch','off',true);

  -- T16 patch flag without trusted context refused (payload built as owner;
  -- signed-in users cannot call the rebuild function directly)
  j2 := jsonb_set(j,'{1}', public.post_mux_truth_item(j->1,U));
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  BEGIN
    PERFORM set_config('app.mux_system_patch','on',true);
    UPDATE public.posts SET media = j2 WHERE id=P;
    bad:=bad+1; res:=res||E'\nFAIL patch flag accepted for signed-in user';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='mux_patch_invalid' THEN ok:=ok+1; res:=res||E'\nPASS patch flag without trusted context refused';
    ELSE bad:=bad+1; res:=res||E'\nFAIL flag untrusted: '||SQLERRM; END IF;
  END;
  PERFORM set_config('app.mux_system_patch','off',true);
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);

  -- T17 real trusted patch succeeds, photo untouched, flag unchanged
  v := public.patch_content_media_from_mux(M);
  SELECT media INTO j2 FROM public.posts WHERE id=P;
  SELECT duration_rule_applies INTO b FROM public.mux_uploads WHERE upload_id='pp_late';
  IF v='patched' AND j2->0 = j->0 AND j2->1->>'mux_playback_id'='PB_LATE' AND j2->1->>'mux_status'='ready'
     AND j2->1->>'url'='https://image.mux.com/PB_LATE/thumbnail.jpg' AND b THEN
    ok:=ok+1; res:=res||E'\nPASS Mux patch makes the video ready, other item untouched, flag unchanged';
  ELSE bad:=bad+1; res:=res||E'\nFAIL patch '||coalesce(v,'null')||' '||j2::text; END IF;

  -- T18 Mux patch for an eligible >60s upload -> too_long, stale playable fields removed
  UPDATE public.mux_uploads SET status='ready', asset_id='A_B', playback_id='PB_B', duration=70 WHERE upload_id='pp_b2';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'pp2','c','experience','public', jsonb_build_array(createv || '{"mux_upload_id":"pp_new2"}'::jsonb)) RETURNING id INTO P2; -- pp_new, processing
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  -- simulate stale playable fields stored before the patch (old-data path)
  ALTER TABLE public.posts DISABLE TRIGGER zz_posts_media_mux_before;
  ALTER TABLE public.posts DISABLE TRIGGER enforce_post_edit_window_trigger;
  UPDATE public.posts SET media = jsonb_build_array(createv || '{"mux_upload_id":"pp_b2","mux_playback_id":"STALE","thumbnail_url":"https://x/t.jpg"}'::jsonb) WHERE id=P2;
  ALTER TABLE public.posts ENABLE TRIGGER zz_posts_media_mux_before;
  ALTER TABLE public.posts ENABLE TRIGGER enforce_post_edit_window_trigger;
  -- Phase 3: the media save above already created this link
  SELECT id INTO M FROM public.mux_upload_mappings WHERE mux_upload_id='pp_b2' AND content_type='post' AND content_id=P2 AND status='pending';
  v := public.patch_content_media_from_mux(M);
  SELECT media->0 INTO j FROM public.posts WHERE id=P2;
  SELECT duration_rule_applies INTO b FROM public.mux_uploads WHERE upload_id='pp_b2';
  IF v='patched' AND j->>'mux_error'='too_long' AND j->>'url'='' AND NOT j ? 'mux_playback_id' AND NOT j ? 'thumbnail_url' AND b THEN
    ok:=ok+1; res:=res||E'\nPASS Mux patch: new 70 s video too long, stale playback/url/thumbnail removed, flag unchanged';
  ELSE bad:=bad+1; res:=res||E'\nFAIL patch too long '||coalesce(v,'null')||' '||j::text; END IF;

  -- T19 existing linking call (sync_mux_post_mappings) still works
  UPDATE public.mux_uploads SET status='ready', asset_id='A_N', playback_id='PB_N', duration=5 WHERE upload_id='pp_new2';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  UPDATE public.posts SET media = jsonb_build_array(photo, createv || '{"order":1,"mux_upload_id":"pp_new2"}'::jsonb) WHERE id=P2;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  j := public.sync_mux_post_mappings(P2, '[{"mux_upload_id":"pp_new2","media_index":1}]'::jsonb);
  SELECT media->1 INTO j2 FROM public.posts WHERE id=P2;
  SELECT status INTO v FROM public.mux_upload_mappings WHERE mux_upload_id='pp_new2' AND content_id=P2;
  IF j2->>'mux_status'='ready' AND j2->>'mux_playback_id'='PB_N' AND v='patched' THEN
    ok:=ok+1; res:=res||E'\nPASS existing linking call still links and patches';
  ELSE bad:=bad+1; res:=res||E'\nFAIL sync '||coalesce(v,'none')||' '||j2::text||' '||j::text; END IF;

  RAISE EXCEPTION 'POST_VIDEO_PHASE2 % passed, % failed%', ok, bad, res;
END $test$;
