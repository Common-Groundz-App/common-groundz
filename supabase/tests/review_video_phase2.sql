-- Mapping reads switch back to the database owner briefly (links are service-only).
-- Phase 2 review-video save-path tests (one statement; ends with RAISE so every
-- fixture is rolled back — the error message is the report). Made-up Mux
-- details only; nothing is sent to Mux. Payloads mirror what the new composer
-- sends: kept videos = the stored object unchanged, new videos = identity only.
DO $test$
DECLARE
  U  constant uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  E  constant uuid := '027b88ee-18b9-44d5-8c60-46626d707df4';
  R uuid; UPD uuid;
  res text := ''; ok int := 0; bad int := 0;
  j jsonb; j2 jsonb; v text; st text;
  photo jsonb := '{"type":"image","url":"https://example.com/p2-a.jpg","order":0}';
BEGIN
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at, asset_id, playback_id, duration)
  VALUES (U, 'p2_ready', 'ready', true, now()+interval '1h', 'a_ready', 'PB_READY', 10),
         (U, 'p2_proc',  'waiting', true, now()+interval '1h', NULL, NULL, NULL),
         (U, 'p2_fail',  'waiting', true, now()+interval '1h', NULL, NULL, NULL),
         (U, 'p2_new',   'waiting', true, now()+interval '1h', NULL, NULL, NULL),
         (U, 'p2_tl',    'waiting', true, now()+interval '1h', NULL, NULL, NULL);

  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';

  -- Review with a ready video (new-video payload: identity only).
  INSERT INTO public.reviews(user_id, entity_id, title, category, rating, visibility, media)
  VALUES (U, E, 'p2', 'brand', 4, 'public',
          jsonb_build_array(photo, '{"type":"video","provider":"mux","url":"https://example.com/p2-poster.jpg","order":1,"mux_upload_id":"p2_ready"}'::jsonb))
  RETURNING id INTO R;
  SELECT media INTO j FROM public.reviews WHERE id = R;

  -- 1. Unrelated text edit, kept ready video round-trips unchanged.
  UPDATE public.reviews SET description = 'edited once', media = j WHERE id = R;
  SELECT media INTO j2 FROM public.reviews WHERE id = R;
  EXECUTE 'reset role';
  SELECT status INTO st FROM public.mux_upload_mappings WHERE mux_upload_id = 'p2_ready';
  EXECUTE 'set local role authenticated';
  IF j2 = j AND j2->1->>'mux_playback_id' = 'PB_READY' THEN ok:=ok+1; res:=res||E'\nPASS ready video kept through text edit (mapping '||coalesce(st,'none')||')';
  ELSE bad:=bad+1; res:=res||E'\nFAIL ready kept '||j2::text; END IF;

  -- 2. Replace within the hour: old link removed, new linked.
  UPDATE public.reviews SET media = jsonb_build_array(photo,
    '{"type":"video","provider":"mux","url":"https://example.com/p2-poster2.jpg","order":1,"mux_upload_id":"p2_proc"}'::jsonb) WHERE id = R;
  EXECUTE 'reset role';
  SELECT status INTO st FROM public.mux_upload_mappings WHERE mux_upload_id = 'p2_ready';
  EXECUTE 'set local role authenticated';
  EXECUTE 'reset role';
  SELECT status INTO v FROM public.mux_upload_mappings WHERE mux_upload_id = 'p2_proc';
  EXECUTE 'set local role authenticated';
  IF st = 'removed' AND v = 'pending' THEN ok:=ok+1; res:=res||E'\nPASS replacement: old link removed, new link pending';
  ELSE bad:=bad+1; res:=res||E'\nFAIL replacement old='||coalesce(st,'none')||' new='||coalesce(v,'none'); END IF;

  -- 3. Unrelated edit with a processing video.
  SELECT media INTO j FROM public.reviews WHERE id = R;
  UPDATE public.reviews SET rating = 3, media = j WHERE id = R;
  SELECT media INTO j2 FROM public.reviews WHERE id = R;
  EXECUTE 'reset role';
  SELECT status INTO v FROM public.mux_upload_mappings WHERE mux_upload_id = 'p2_proc';
  EXECUTE 'set local role authenticated';
  IF j2 = j AND v = 'pending' THEN ok:=ok+1; res:=res||E'\nPASS processing video kept through rating edit';
  ELSE bad:=bad+1; res:=res||E'\nFAIL processing kept '||coalesce(v,'none'); END IF;

  -- 4. Removal within the hour.
  UPDATE public.reviews SET media = jsonb_build_array(photo) WHERE id = R;
  EXECUTE 'reset role';
  SELECT status INTO v FROM public.mux_upload_mappings WHERE mux_upload_id = 'p2_proc';
  EXECUTE 'set local role authenticated';
  IF v = 'removed' THEN ok:=ok+1; res:=res||E'\nPASS removal marks link removed';
  ELSE bad:=bad+1; res:=res||E'\nFAIL removal '||coalesce(v,'none'); END IF;

  -- 5. Saved video that later fails: unrelated edit still saves and keeps it.
  UPDATE public.reviews SET media = jsonb_build_array(photo,
    '{"type":"video","provider":"mux","url":"https://example.com/p2-poster3.jpg","order":1,"mux_upload_id":"p2_fail"}'::jsonb) WHERE id = R;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.mux_uploads SET status = 'errored' WHERE upload_id = 'p2_fail';
  PERFORM public.patch_content_media_from_mux((SELECT id FROM public.mux_upload_mappings WHERE mux_upload_id = 'p2_fail'));
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  SELECT media INTO j FROM public.reviews WHERE id = R;
  BEGIN
    UPDATE public.reviews SET description = 'edited with failed video', media = j WHERE id = R;
    SELECT media INTO j2 FROM public.reviews WHERE id = R;
    IF j2 = j THEN ok:=ok+1; res:=res||E'\nPASS failed saved video kept through text edit (status '||coalesce(j->1->>'mux_status','?')||')';
    ELSE bad:=bad+1; res:=res||E'\nFAIL failed kept '||j2::text; END IF;
  EXCEPTION WHEN others THEN bad:=bad+1; res:=res||E'\nFAIL failed saved video blocked text edit ('||SQLERRM||')'; END;

  -- 6. Timeline: add with a new video, then unrelated edit via the real RPC keeps it.
  INSERT INTO public.review_updates(review_id, user_id, comment, media)
  VALUES (R, U, 'tl', jsonb_build_array('{"type":"video","provider":"mux","url":"https://example.com/p2-tl.jpg","order":0,"mux_upload_id":"p2_tl"}'::jsonb))
  RETURNING id INTO UPD;
  SELECT media INTO j FROM public.review_updates WHERE id = UPD;
  SELECT (public.edit_latest_review_update(R, UPD, NULL, 'tl edited', j, NULL))::text INTO v;
  SELECT media INTO j2 FROM public.review_updates WHERE id = UPD;
  IF v LIKE '%ok%' AND j2 = j AND (SELECT comment FROM public.review_updates WHERE id = UPD) = 'tl edited' THEN
    ok:=ok+1; res:=res||E'\nPASS timeline edit keeps processing video';
  ELSE bad:=bad+1; res:=res||E'\nFAIL timeline edit '||coalesce(v,'null')||' '||coalesce(j2::text,''); END IF;

  -- 7. Timeline: removal via the real RPC marks the link removed.
  SELECT (public.edit_latest_review_update(R, UPD, NULL, 'tl edited', '[]'::jsonb, NULL))::text INTO v;
  EXECUTE 'reset role';
  SELECT status INTO st FROM public.mux_upload_mappings WHERE mux_upload_id = 'p2_tl';
  EXECUTE 'set local role authenticated';
  IF st = 'removed' THEN ok:=ok+1; res:=res||E'\nPASS timeline removal marks link removed';
  ELSE bad:=bad+1; res:=res||E'\nFAIL timeline removal '||coalesce(st,'none')||' rpc='||coalesce(v,'null'); END IF;

  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '', true);

  -- 8. Nothing deleted on the Mux side: all upload rows still present.
  IF (SELECT count(*) FROM public.mux_uploads WHERE upload_id LIKE 'p2\_%') = 5 THEN ok:=ok+1; res:=res||E'\nPASS no upload rows deleted';
  ELSE bad:=bad+1; res:=res||E'\nFAIL upload rows changed'; END IF;

  RAISE EXCEPTION 'PHASE2 RESULT: % passed, % failed%', ok, bad, res;
END
$test$;
