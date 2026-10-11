-- Phase 1 review-video server tests. Runs as one DO block and ends with
-- RAISE EXCEPTION so every fixture is rolled back; the message is the report.
DO $test$
DECLARE
  U  constant uuid := 'abfcbf43-b985-40dc-933c-201e5448b794'; -- test author
  E  constant uuid := '027b88ee-18b9-44d5-8c60-46626d707df4'; -- entity not yet reviewed by U
  OTHER uuid;
  R uuid; R2 uuid; UPD uuid; M uuid;
  res text := '';
  ok int := 0; bad int := 0;
  v text; j jsonb; r_row record;
  vid jsonb; photo jsonb := '{"type":"image","url":"https://example.com/a.jpg","order":0}';
  photo2 jsonb := '{"type":"image","url":"https://example.com/b.jpg","order":1}';
  q_before int; upd_before timestamptz;

  PROCEDURE_DUMMY int;
BEGIN
  SELECT id INTO OTHER FROM public.profiles WHERE id <> U LIMIT 1;

  -- fixtures: uploads
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at)
  VALUES (U, 't_up_ready', 'waiting', true, now()+interval '1h'),
         (U, 't_up_long', 'waiting', true, now()+interval '1h'),
         (U, 't_up_err', 'waiting', true, now()+interval '1h'),
         (U, 't_up_upd', 'waiting', true, now()+interval '1h'),
         (U, 't_up_upd2', 'waiting', true, now()+interval '1h'),
         (OTHER, 't_up_other', 'waiting', true, now()+interval '1h');
  vid := '{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"t_up_ready","mux_status":"ready","mux_playback_id":"FORGED"}';

  -- 1. save with video: linked, client fields overwritten
  INSERT INTO public.reviews(user_id, entity_id, title, category, rating, visibility, media)
  VALUES (U, E, 't', 'brand', 4, 'public', jsonb_build_array(vid, photo)) RETURNING id INTO R;
  SELECT media INTO j FROM public.reviews WHERE id = R;
  IF j->0->>'mux_status' = 'preparing' AND j->0->>'mux_playback_id' IS NULL THEN ok:=ok+1; res:=res||E'\nPASS forged playback fields replaced by trusted state';
  ELSE bad:=bad+1; res:=res||E'\nFAIL forged fields '||j::text; END IF;
  SELECT status INTO v FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_ready';
  IF v='pending' THEN ok:=ok+1; res:=res||E'\nPASS mapping created in same save (pending)'; ELSE bad:=bad+1; res:=res||E'\nFAIL mapping '||coalesce(v,'none'); END IF;
  IF (SELECT image_url FROM public.reviews WHERE id=R) = 'https://example.com/a.jpg' THEN ok:=ok+1; res:=res||E'\nPASS cover = next photo while video processing';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover processing'; END IF;

  -- make it old (edit window closed)
  PERFORM set_config('app.review_system_write','on',true);
  UPDATE public.reviews SET created_at = now() - interval '3 hours' WHERE id = R;
  PERFORM set_config('app.review_system_write','off',true);
  SELECT updated_at INTO upd_before FROM public.reviews WHERE id = R;
  SELECT count(*) INTO q_before FROM public.media_deletion_candidates;

  -- 2. webhook-ready after edit window
  UPDATE public.mux_uploads SET status='asset_created', asset_id='a1' WHERE upload_id='t_up_ready';
  UPDATE public.mux_uploads SET status='ready', playback_id='PB1', duration=12 WHERE upload_id='t_up_ready';
  SELECT id INTO M FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_ready';
  v := public.patch_content_media_from_mux(M);
  SELECT media, image_url, updated_at, description, rating INTO r_row FROM public.reviews WHERE id=R;
  IF v='patched' AND r_row.media->0->>'mux_playback_id'='PB1' AND r_row.media->1 = photo THEN ok:=ok+1; res:=res||E'\nPASS ready patch after edit hour, other slot untouched';
  ELSE bad:=bad+1; res:=res||E'\nFAIL patch '||v||' '||r_row.media::text; END IF;
  IF r_row.updated_at = upd_before THEN ok:=ok+1; res:=res||E'\nPASS patch did not move updated_at'; ELSE bad:=bad+1; res:=res||E'\nFAIL updated_at moved'; END IF;
  IF r_row.image_url = 'https://image.mux.com/PB1/thumbnail.jpg' THEN ok:=ok+1; res:=res||E'\nPASS cover = Mux poster when ready';
  ELSE bad:=bad+1; res:=res||E'\nFAIL cover '||coalesce(r_row.image_url,'null'); END IF;
  IF (SELECT count(*) FROM public.media_deletion_candidates) = q_before THEN ok:=ok+1; res:=res||E'\nPASS no photo queued for cleanup by patch';
  ELSE bad:=bad+1; res:=res||E'\nFAIL D2 queued'; END IF;

  -- 3. duplicate webhook is idempotent
  v := public.patch_content_media_from_mux(M);
  IF v='noop_already_patched' THEN ok:=ok+1; res:=res||E'\nPASS duplicate event no-op'; ELSE bad:=bad+1; res:=res||E'\nFAIL dup '||v; END IF;

  -- 4. forged patch flag from a signed-in user, edit after hour → rejected
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  BEGIN
    PERFORM set_config('app.mux_review_patch','on',true);
    UPDATE public.reviews SET description='hacked' WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL forged flag text edit allowed';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS forged flag text edit rejected ('||SQLERRM||')'; END;
  BEGIN
    PERFORM set_config('app.mux_review_patch','on',true);
    UPDATE public.reviews SET media = jsonb_set(media,'{0,mux_status}','"ready"') WHERE id=R;
    -- value already ready: try a forged playback id instead
    UPDATE public.reviews SET media = jsonb_set(media,'{0,mux_playback_id}','"EVIL"') WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL forged flag mux edit allowed';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS forged flag mux edit by user rejected ('||SQLERRM||')'; END;
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

  -- 5. service-role patch that tries to touch text is rejected
  BEGIN
    PERFORM set_config('app.mux_review_patch','on',true);
    UPDATE public.reviews SET description='x' WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL server patch flag allowed text change';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS server patch flag cannot change text'; END;
  PERFORM set_config('app.mux_review_patch','off',true);

  -- 6. limits, ownership, public-only (fresh second review on another entity not needed: use updates)
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

  -- 7. timeline update with video, then visibility blocked by thread
  INSERT INTO public.review_updates(review_id, user_id, rating, comment, media)
  VALUES (R, U, 3, 'u', jsonb_build_array(vid || '{"mux_upload_id":"t_up_upd"}')) RETURNING id INTO UPD;
  UPDATE public.reviews SET media = jsonb_build_array(photo) WHERE id=R;  -- root now photo-only
  IF (SELECT status FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_ready')='removed'
     AND (SELECT image_url FROM public.reviews WHERE id=R)='https://example.com/a.jpg' THEN
    ok:=ok+1; res:=res||E'\nPASS removed video → mapping removed (kept as history), cover recomputed';
  ELSE bad:=bad+1; res:=res||E'\nFAIL removal mapping/cover'; END IF;
  BEGIN
    UPDATE public.reviews SET visibility='circle_only' WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL visibility allowed with timeline video';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS visibility locked by timeline video'; END;

  -- 8. late webhook for removed video ignored
  v := public.patch_content_media_from_mux(M);
  IF v IN ('noop_removed') THEN ok:=ok+1; res:=res||E'\nPASS late event for removed video ignored'; ELSE bad:=bad+1; res:=res||E'\nFAIL late '||v; END IF;

  -- 9. too long + broken removal after hour on timeline update
  UPDATE public.mux_uploads SET status='asset_created', asset_id='a2' WHERE upload_id='t_up_upd';
  UPDATE public.mux_uploads SET status='ready', playback_id='PB2', duration=95 WHERE upload_id='t_up_upd';
  SELECT id INTO M FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_upd';
  v := public.patch_content_media_from_mux(M);
  SELECT media INTO j FROM public.review_updates WHERE id=UPD;
  IF j->0->>'mux_error'='too_long' AND j->0->>'mux_playback_id' IS NULL THEN ok:=ok+1; res:=res||E'\nPASS over-60s marked too_long, no playback id';
  ELSE bad:=bad+1; res:=res||E'\nFAIL too long '||j::text; END IF;
  UPDATE public.review_updates SET created_at = now() - interval '3 hours' WHERE id=UPD;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  j := public.remove_broken_review_video('review_update', UPD, 't_up_upd');
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  SELECT * INTO r_row FROM public.review_updates WHERE id=UPD;
  IF j->>'status'='ok' AND jsonb_array_length(r_row.media)=0 AND r_row.comment='u' AND r_row.rating=3 THEN
    ok:=ok+1; res:=res||E'\nPASS owner removed broken timeline video after hour; text/rating unchanged';
  ELSE bad:=bad+1; res:=res||E'\nFAIL broken removal '||j::text; END IF;

  -- 10. removal refuses a healthy video
  UPDATE public.review_updates SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_upd2"}') WHERE id=UPD;
  UPDATE public.mux_uploads SET status='asset_created', asset_id='a3' WHERE upload_id='t_up_upd2';
  UPDATE public.mux_uploads SET status='ready', playback_id='PB3', duration=10 WHERE upload_id='t_up_upd2';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  j := public.remove_broken_review_video('review_update', UPD, 't_up_upd2');
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  IF j->>'status'='not_broken' THEN ok:=ok+1; res:=res||E'\nPASS removal refused for healthy video'; ELSE bad:=bad+1; res:=res||E'\nFAIL healthy removal '||j::text; END IF;

  -- 11. save after Mux already finished → linked as ready immediately
  SELECT media INTO j FROM public.review_updates WHERE id=UPD;
  IF j->0->>'mux_status'='ready' AND (SELECT status FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_upd2')='patched' THEN
    ok:=ok+1; res:=res||E'\nPASS Mux-finished-before-save is ready immediately';
  ELSE bad:=bad+1; res:=res||E'\nFAIL pre-ready '||j::text; END IF;

  -- 12. delete → mappings removed, rows kept
  DELETE FROM public.review_updates WHERE id=UPD;
  IF (SELECT status FROM public.mux_upload_mappings WHERE mux_upload_id='t_up_upd2')='removed' THEN
    ok:=ok+1; res:=res||E'\nPASS deleted update → mapping removed, history kept';
  ELSE bad:=bad+1; res:=res||E'\nFAIL delete mapping'; END IF;

  -- 13. private review cannot take video
  BEGIN
    UPDATE public.reviews SET visibility='private' WHERE id=R;  -- now allowed (no videos)
    UPDATE public.reviews SET media = jsonb_build_array(vid || '{"mux_upload_id":"t_up_long"}') WHERE id=R;
    bad:=bad+1; res:=res||E'\nFAIL private review took video';
  EXCEPTION WHEN others THEN ok:=ok+1; res:=res||E'\nPASS private review rejects video ('||SQLERRM||')'; END;

  RAISE EXCEPTION 'TEST REPORT: % passed, % failed%', ok, bad, res;
END
$test$;
