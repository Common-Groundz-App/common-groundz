-- Phase 1 review-video server tests (run as one statement; ends with RAISE so
-- every fixture is rolled back — the error message is the report).
DO $test$
DECLARE
  U  constant uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  E  constant uuid := '027b88ee-18b9-44d5-8c60-46626d707df4';
  OTHER uuid;
  R uuid; UPD uuid; M uuid;
  res text := '';
  ok int := 0; bad int := 0;
  v text; j jsonb; r_row record;
  vid jsonb; photo jsonb := '{"type":"image","url":"https://example.com/a.jpg","order":0}';
  photo2 jsonb := '{"type":"image","url":"https://example.com/b.jpg","order":1}';
  q_before int; upd_before timestamptz;
BEGIN
  SELECT id INTO OTHER FROM public.profiles WHERE id <> U LIMIT 1;
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at)
  VALUES (U, 't_up_ready', 'waiting', true, now()+interval '1h'),
         (U, 't_up_long', 'waiting', true, now()+interval '1h'),
         (U, 't_up_upd', 'waiting', true, now()+interval '1h'),
         (U, 't_up_upd2', 'waiting', true, now()+interval '1h'),
         (OTHER, 't_up_other', 'waiting', true, now()+interval '1h');
  vid := '{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"t_up_ready","mux_status":"ready","mux_playback_id":"FORGED"}';

  INSERT INTO public.reviews(user_id, entity_id, title, category, rating, visibility, media)
  VALUES (U, E, 't', 'brand', 4, 'public', jsonb_build_array(vid, photo)) RETURNING id INTO R;
  SELECT media INTO j FROM public.reviews WHERE id = R;
  IF j->0->>'mux_status' = 'preparing' AND j->0->>'mux_playback_id' IS NULL THEN ok:=ok+1; res:=res||E'\nPASS forged playback fields replaced by trusted state';
  ELSE bad:=bad+1; res:=res||E'\nFAIL forged fields '||j::text; END IF;
  SELECT status INTO v FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_ready';
  IF v='pending' THEN ok:=ok+1; res:=res||E'\nPASS mapping created in same save (pending)'; ELSE bad:=bad+1; res:=res||E'\nFAIL mapping '||coalesce(v,'none'); END IF;
  IF (SELECT image_url FROM public.reviews WHERE id=R) = 'https://example.com/a.jpg' THEN ok:=ok+1; res:=res||E'\nPASS cover = next photo while video processing';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover processing'; END IF;

  PERFORM set_config('app.review_system_write','on',true);
  UPDATE public.reviews SET created_at = now() - interval '3 hours' WHERE id = R;
  PERFORM set_config('app.review_system_write','off',true);
  SELECT updated_at INTO upd_before FROM public.reviews WHERE id = R;
  SELECT count(*) INTO q_before FROM public.media_deletion_candidates;

  UPDATE public.mux_uploads SET status='asset_created', asset_id='a1' WHERE upload_id='t_up_ready';
  UPDATE public.mux_uploads SET status='ready', playback_id='PB1', duration=12 WHERE upload_id='t_up_ready';
  SELECT id INTO M FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_ready';
  v := public.patch_content_media_from_mux(M);
  SELECT media, image_url, updated_at INTO r_row FROM public.reviews WHERE id=R;
  IF v='patched' AND r_row.media->0->>'mux_playback_id'='PB1' AND r_row.media->1 = photo THEN ok:=ok+1; res:=res||E'\nPASS ready patch after edit hour, other slot untouched';
  ELSE bad:=bad+1; res:=res||E'\nFAIL patch '||v||' '||r_row.media::text; END IF;
  IF r_row.updated_at = upd_before THEN ok:=ok+1; res:=res||E'\nPASS patch did not move updated_at'; ELSE bad:=bad+1; res:=res||E'\nFAIL updated_at moved'; END IF;
  IF r_row.image_url = 'https://image.mux.com/PB1/thumbnail.jpg' THEN ok:=ok+1; res:=res||E'\nPASS cover = Mux poster when ready';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover '||coalesce(r_row.image_url,'null'); END IF;
  IF (SELECT count(*) FROM public.media_deletion_candidates) = q_before THEN ok:=ok+1; res:=res||E'\nPASS no photo queued for cleanup by patch';
  ELSE bad:=bad+1; res:=res||E'\nFAIL D2 queued'; END IF;

  v := public.patch_content_media_from_mux(M);
  IF v='noop_already_patched' THEN ok:=ok+1; res:=res||E'\nPASS duplicate event no-op'; ELSE bad:=bad+1; res:=res||E'\nFAIL dup '||v; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  BEGIN
    PERFORM set_config('app.mux_review_patch','on',true);
    UPDATE public.reviews SET description='hacked' WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL forged flag text edit allowed';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS signed-in user + forged flag + expired text edit rejected ('||SQLERRM||')'; END;
  BEGIN
    PERFORM set_config('app.mux_review_patch','on',true);
    UPDATE public.reviews SET media = jsonb_set(media,'{0,mux_playback_id}','"EVIL"') WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL forged flag mux edit allowed';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS signed-in user + forged flag video edit rejected ('||SQLERRM||')'; END;
  PERFORM set_config('app.mux_review_patch','off',true);
  BEGIN
    PERFORM public.patch_review_media_from_mux(M);
    bad:=bad+1; res:=res||E'\nFAIL user could call internal patch';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS user cannot call internal patch ('||SQLERRM||')'; END;
  BEGIN
    UPDATE public.reviews SET visibility='private' WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL visibility change with video allowed';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS visibility locked while review has video ('||SQLERRM||')'; END;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);

  BEGIN
    PERFORM set_config('app.mux_review_patch','on',true);
    UPDATE public.reviews SET description='x' WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL server patch flag allowed text change';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS server patch flag cannot change text'; END;
  PERFORM set_config('app.mux_review_patch','off',true);

  BEGIN
    UPDATE public.reviews SET media = jsonb_build_array(photo,photo,photo,photo,photo2) WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL 5 items allowed';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS 5 items rejected'; END;
  BEGIN
    UPDATE public.reviews SET media = jsonb_build_array(vid, vid || '{"mux_upload_id":"t_up_long"}') WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL 2 videos allowed';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS 2 videos rejected'; END;
  BEGIN
    UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_other"}') WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL other user upload attached';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS someone else''s upload rejected'; END;

  INSERT INTO public.review_updates(review_id, user_id, rating, comment, media)
  VALUES (R, U, 3, 'u', jsonb_build_array(vid || '{"mux_upload_id":"t_up_upd"}')) RETURNING id INTO UPD;
  UPDATE public.reviews SET media = jsonb_build_array(photo) WHERE id=R;
  IF (SELECT status FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_ready')='removed'
     AND (SELECT image_url FROM public.reviews WHERE id=R)='https://example.com/a.jpg' THEN
    ok:=ok+1; res:=res||E'\nPASS removed video: mapping removed (history kept), cover recomputed';
  ELSE bad:=bad+1; res:=res||E'\nFAIL removal mapping/cover'; END IF;
  BEGIN
    UPDATE public.reviews SET visibility='circle_only' WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL visibility allowed with timeline video';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS visibility locked by timeline video'; END;

  v := public.patch_content_media_from_mux(M);
  IF v='noop_removed' THEN ok:=ok+1; res:=res||E'\nPASS late event for removed video ignored'; ELSE bad:=bad+1; res:=res||E'\nFAIL late '||v; END IF;

  UPDATE public.mux_uploads SET status='asset_created', asset_id='a2' WHERE upload_id='t_up_upd';
  UPDATE public.mux_uploads SET status='ready', playback_id='PB2', duration=95 WHERE upload_id='t_up_upd';
  SELECT id INTO M FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_upd';
  v := public.patch_content_media_from_mux(M);
  SELECT media INTO j FROM public.review_updates WHERE id=UPD;
  IF j->0->>'mux_error'='too_long' AND j->0->>'mux_playback_id' IS NULL THEN ok:=ok+1; res:=res||E'\nPASS over-60s marked too_long, no playback id';
  ELSE bad:=bad+1; res:=res||E'\nFAIL too long '||j::text; END IF;
  -- Strict one-hour rule: after the hour no author media change, even for a broken video.
  UPDATE public.review_updates SET created_at = now() - interval '3 hours' WHERE id=UPD;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  BEGIN
    EXECUTE 'SELECT public.remove_broken_review_video($1,$2,$3)' USING 'review_update', UPD, 't_up_upd';
    bad:=bad+1; res:=res||E'\nFAIL removed exception still callable';
  EXCEPTION WHEN undefined_function THEN ok:=ok+1; res:=res||E'\nPASS broken-video removal action no longer exists'; END;
  UPDATE public.review_updates SET media='[]'::jsonb WHERE id=UPD;
  j := public.edit_latest_review_update(R, UPD, 3, 'u', '[]'::jsonb, NULL);
  v := j->>'status';
  j := public.edit_latest_review_update(R, UPD, 3, 'u', jsonb_build_array(vid || '{"mux_upload_id":"t_up_upd2"}'), NULL);
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT * INTO r_row FROM public.review_updates WHERE id=UPD;
  IF jsonb_array_length(r_row.media)=1 AND r_row.media->0->>'mux_upload_id'='t_up_upd' AND v='expired' AND j->>'status'='expired' THEN
    ok:=ok+1; res:=res||E'\nPASS timeline after hour: direct API removal, Edit removal and video swap all refused';
  ELSE bad:=bad+1; res:=res||E'\nFAIL timeline expiry '||coalesce(v,'null')||' '||j::text||' '||r_row.media::text; END IF;

  -- Root review after the hour: broken video cannot be removed or swapped.
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at) VALUES (U, 't_up_broken', 'waiting', true, now()+interval '1h');
  UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_broken"}', photo) WHERE id=R;
  UPDATE public.mux_uploads SET status='errored' WHERE upload_id='t_up_broken';
  SELECT id INTO M FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_broken';
  SELECT updated_at INTO upd_before FROM public.reviews WHERE id=R;
  v := public.patch_content_media_from_mux(M);
  SELECT media, updated_at INTO r_row FROM public.reviews WHERE id=R;
  IF r_row.media->0->>'mux_status'='errored' AND r_row.media->0->>'mux_playback_id' IS NULL AND r_row.updated_at=upd_before THEN
    ok:=ok+1; res:=res||E'\nPASS system marks root video failed after hour, edit time unchanged ('||v||')';
  ELSE bad:=bad+1; res:=res||E'\nFAIL root failed patch '||v||' '||r_row.media::text; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  BEGIN
    UPDATE public.reviews SET media = jsonb_build_array(photo) WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL root broken video removed after hour';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS root: removing only the broken video after hour refused ('||SQLERRM||')'; END;
  BEGIN
    UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_long"}', photo) WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL root video swapped after hour';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS root: swapping the video after hour refused ('||SQLERRM||')'; END;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.reviews SET media = jsonb_build_array(photo) WHERE id=R;  -- fixture reset (system, no user)

  v := public.patch_content_media_from_mux(M);
  SELECT media INTO j FROM public.review_updates WHERE id=UPD;
  IF v='patched' AND j->0->>'mux_playback_id'='PB3' THEN ok:=ok+1; res:=res||E'\nPASS timeline update patched to ready';
  ELSE bad:=bad+1; res:=res||E'\nFAIL upd patch '||v||j::text; END IF;

  DELETE FROM public.review_updates WHERE id=UPD;
  IF (SELECT status FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_upd2')='removed' THEN
    ok:=ok+1; res:=res||E'\nPASS deleted update: mapping removed, history kept';
  ELSE bad:=bad+1; res:=res||E'\nFAIL delete mapping'; END IF;

  BEGIN
    UPDATE public.reviews SET visibility='private' WHERE id=R;
    UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_long"}') WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL private review took video';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS private review rejects video ('||SQLERRM||')'; END;

  -- cover tests
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at) VALUES (U, 't_up_c1', 'waiting', true, now()+interval '1h');
  UPDATE public.mux_uploads SET status='asset_created', asset_id='ac1' WHERE upload_id='t_up_c1';
  UPDATE public.mux_uploads SET status='ready', playback_id='PC1', duration=5 WHERE upload_id='t_up_c1';
  UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_c1"}') WHERE id=R;
  UPDATE public.reviews SET media = NULL WHERE id=R;
  IF (SELECT image_url FROM public.reviews WHERE id=R) IS NULL THEN ok:=ok+1; res:=res||E'\nPASS cover 1: video-only, remove video (NULL media) -> cover cleared';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover 1'; END IF;
  UPDATE public.reviews SET media = jsonb_build_array(photo) WHERE id=R;
  UPDATE public.reviews SET media = '[]'::jsonb WHERE id=R;
  IF (SELECT image_url FROM public.reviews WHERE id=R) IS NULL THEN ok:=ok+1; res:=res||E'\nPASS cover 2: photo-only, remove photo ([]) -> cover cleared';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover 2'; END IF;
  UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_c1"}', photo2) WHERE id=R;
  v := (SELECT image_url FROM public.reviews WHERE id=R);
  UPDATE public.reviews SET media = jsonb_build_array(photo2) WHERE id=R;
  IF v = 'https://image.mux.com/PC1/thumbnail.jpg' AND (SELECT image_url FROM public.reviews WHERE id=R) = 'https://example.com/b.jpg' THEN
    ok:=ok+1; res:=res||E'\nPASS cover 3: video+photo, remove video -> photo becomes cover';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover 3 '||coalesce(v,'null'); END IF;
  UPDATE public.reviews SET media = jsonb_build_array(photo, vid || '{"mux_upload_id":"t_up_c1"}') WHERE id=R;
  v := (SELECT image_url FROM public.reviews WHERE id=R);
  UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_c1"}') WHERE id=R;
  IF v = 'https://example.com/a.jpg' AND (SELECT image_url FROM public.reviews WHERE id=R) = 'https://image.mux.com/PC1/thumbnail.jpg' THEN
    ok:=ok+1; res:=res||E'\nPASS cover 4a: photo+ready video, remove photo -> video poster (re-added video mapping: '||(SELECT status FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_c1')||')';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover 4a'; END IF;
  UPDATE public.reviews SET media = jsonb_build_array(photo, vid || '{"mux_upload_id":"t_up_long"}') WHERE id=R;
  UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_long"}') WHERE id=R;
  IF (SELECT image_url FROM public.reviews WHERE id=R) IS NULL THEN ok:=ok+1; res:=res||E'\nPASS cover 4b: photo+processing video, remove photo -> no cover until ready';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover 4b'; END IF;

  INSERT INTO public.review_updates(review_id, user_id, rating, comment, media) VALUES (R, U, 4, 'p', jsonb_build_array(photo));
  ok:=ok+1; res:=res||E'\nPASS photo-only timeline update saves (regression)';

  RAISE EXCEPTION 'TEST REPORT: % passed, % failed%', ok, bad, res;
END
$test$;
