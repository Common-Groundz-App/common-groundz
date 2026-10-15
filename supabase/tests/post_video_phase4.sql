-- Post video Phase 4 (stable media IDs) tests. One statement; ends with RAISE so
-- every fixture is rolled back — the error message is the report. Made-up Mux
-- details only; nothing is sent to Mux. Author = Hana (test account).
-- No table triggers are switched off: ambiguous/duplicate history is tested by
-- calling post_media_assign_ids() directly.
-- 29 checks (T1-T29). NOT covered (blocked: single-connection SQL tool): true simultaneous races.
DO $test$
DECLARE
  U  constant uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  H  constant text := 'https://uyjtgybbktgapspodajy.supabase.co/storage/v1/object/';
  RE constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  A  constant text := '0a000000-0000-4000-8000-00000000000a';
  B  constant text := '0b000000-0000-4000-8000-00000000000b';
  C  constant text := '0c000000-0000-4000-8000-00000000000c';
  D  constant text := '0d000000-0000-4000-8000-00000000000d';
  UP constant text := '0E000000-0000-4000-8000-00000000000E';
  vid jsonb := '{"type":"video","provider":"mux","url":"","caption":"","order":0}';
  P uuid; P2 uuid; P3 uuid; P4 uuid; P5 uuid; P6 uuid; P7 uuid; MID uuid;
  res text := ''; ok int := 0; bad int := 0;
  j jsonb; j2 jsonb; v text; v2 text; n int; err text;
  i1 text; i2 text; i3 text;
BEGIN
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at)
  SELECT U, x, 'waiting', true, now()+interval '1h'
    FROM unnest(ARRAY['p4_b','p4_c','p4_d','p4_e','p4_f','p4_g','p4_i']) x;
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at, asset_id, playback_id, duration)
  VALUES (U,'p4_h','ready',true,now()+interval '1h','A_H4','PB_H4',8);

  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';

  -- T1 signed-in save works; valid client UUID on a new item is kept
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4','c','experience','public', jsonb_build_array(
    jsonb_build_object('type','image','url',H||'public/post_media/u/1.jpg','order',0,'id',A))) RETURNING id INTO P;
  SELECT media->0->>'id' INTO v FROM public.posts WHERE id=P;
  IF v = A THEN ok:=ok+1; res:=res||E'\nPASS signed-in save works; valid client ID kept';
  ELSE bad:=bad+1; res:=res||E'\nFAIL client ID '||coalesce(v,'null'); END IF;

  -- T2 missing / empty / non-UUID IDs on new items get fresh lowercase UUIDs
  UPDATE public.posts SET media = jsonb_build_array(
    jsonb_build_object('type','image','url',H||'public/post_media/u/1.jpg','order',0,'id',A),
    jsonb_build_object('type','image','url',H||'public/post_media/u/2.jpg','order',1),
    jsonb_build_object('type','image','url',H||'public/post_media/u/3.jpg','order',2,'id',''),
    jsonb_build_object('type','image','url',H||'public/post_media/u/4.jpg','order',3,'id','nope')) WHERE id=P;
  SELECT media INTO j FROM public.posts WHERE id=P;
  IF j->0->>'id'=A AND j->1->>'id' ~ RE AND j->2->>'id' ~ RE AND j->3->>'id' ~ RE
     AND (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(j) e)=4 THEN
    ok:=ok+1; res:=res||E'\nPASS missing/empty/invalid IDs replaced with fresh lowercase UUIDs';
  ELSE bad:=bad+1; res:=res||E'\nFAIL generated IDs '||j::text; END IF;
  i2 := j->1->>'id';

  -- T3 new item reusing a saved item's ID gets a fresh one; saved item keeps its own
  UPDATE public.posts SET media = jsonb_build_array(j->0, j->1,
    jsonb_build_object('type','image','url',H||'public/post_media/u/5.jpg','order',2,'id',A)) WHERE id=P;
  SELECT media INTO j FROM public.posts WHERE id=P;
  IF j->0->>'id'=A AND j->1->>'id'=i2 AND j->2->>'id' ~ RE AND j->2->>'id'<>A THEN
    ok:=ok+1; res:=res||E'\nPASS new item reusing a saved ID gets a fresh ID';
  ELSE bad:=bad+1; res:=res||E'\nFAIL reuse '||j::text; END IF;

  -- T4 forged ID on an existing photo is restored
  UPDATE public.posts SET media = jsonb_build_array(j->0 || jsonb_build_object('id',B), j->1, j->2) WHERE id=P;
  SELECT media->0->>'id' INTO v FROM public.posts WHERE id=P;
  IF v=A THEN ok:=ok+1; res:=res||E'\nPASS forged ID on existing photo restored';
  ELSE bad:=bad+1; res:=res||E'\nFAIL forged photo '||coalesce(v,'null'); END IF;

  -- T5 two new items with the same ID refused, Post unchanged
  SELECT media INTO j FROM public.posts WHERE id=P;
  err := NULL;
  BEGIN
    UPDATE public.posts SET media = jsonb_build_array(j->0,
      jsonb_build_object('type','image','url',H||'public/post_media/u/6.jpg','order',1,'id',C),
      jsonb_build_object('type','image','url',H||'public/post_media/u/7.jpg','order',2,'id',C)) WHERE id=P;
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err='post_media_duplicate_id' AND (SELECT media FROM public.posts WHERE id=P)=j THEN
    ok:=ok+1; res:=res||E'\nPASS duplicate new IDs refused; Post unchanged';
  ELSE bad:=bad+1; res:=res||E'\nFAIL duplicate '||coalesce(err,'accepted'); END IF;

  -- T6 canonical storage: signed+token and ?x=1 variants keep one ID; foreign host not matched
  UPDATE public.posts SET media = jsonb_build_array(
    jsonb_build_object('type','image','url',H||'sign/post_media/u/1.jpg?token=abc','order',0,'id',B)) WHERE id=P;
  SELECT media->0->>'id' INTO v FROM public.posts WHERE id=P;
  UPDATE public.posts SET media = jsonb_build_array(
    jsonb_build_object('type','image','url',H||'public/post_media/u/1.jpg?x=1','order',0,'id',C)) WHERE id=P;
  SELECT media->0->>'id' INTO v2 FROM public.posts WHERE id=P;
  UPDATE public.posts SET media = jsonb_build_array(
    jsonb_build_object('type','image','url','https://example.com/storage/v1/object/public/post_media/u/1.jpg','order',0,'id',D)) WHERE id=P;
  SELECT media->0->>'id' INTO err FROM public.posts WHERE id=P;
  IF v=A AND v2=A AND err=D THEN ok:=ok+1; res:=res||E'\nPASS signed/tokenised/query variants keep one ID; foreign host not matched';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL canonical %s %s %s', v, v2, err); END IF;

  -- T7 removing the first of three: others keep IDs (also when an old tab omits IDs)
  UPDATE public.posts SET media = jsonb_build_array(
    jsonb_build_object('type','image','url',H||'public/post_media/u/1.jpg','order',0),
    jsonb_build_object('type','image','url',H||'public/post_media/u/2.jpg','order',1),
    jsonb_build_object('type','image','url',H||'public/post_media/u/3.jpg','order',2)) WHERE id=P;
  SELECT media INTO j FROM public.posts WHERE id=P;
  i1 := j->1->>'id'; i3 := j->2->>'id';
  UPDATE public.posts SET media = jsonb_build_array(((j->1) - 'id') || '{"order":0}', ((j->2) - 'id') || '{"order":1}') WHERE id=P;
  SELECT media INTO j2 FROM public.posts WHERE id=P;
  IF j2->0->>'id'=i1 AND j2->1->>'id'=i3 AND ((j2->0)-'order')=((j->1)-'order') AND ((j2->1)-'order')=((j->2)-'order') THEN
    ok:=ok+1; res:=res||E'\nPASS removal keeps the others'' IDs, items otherwise unchanged (old tab without IDs too)';
  ELSE bad:=bad+1; res:=res||E'\nFAIL removal '||j2::text; END IF;

  -- T8 caption-only edit leaves media byte-identical
  UPDATE public.posts SET content='caption only' WHERE id=P;
  IF (SELECT media FROM public.posts WHERE id=P)=j2 THEN ok:=ok+1; res:=res||E'\nPASS caption-only edit: media byte-identical';
  ELSE bad:=bad+1; res:=res||E'\nFAIL caption-only'; END IF;

  -- T9 helper is server-only
  err := NULL;
  BEGIN PERFORM public.post_media_assign_ids('[]'::jsonb,'[]'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN err := 'denied'; END;
  IF err='denied' THEN ok:=ok+1; res:=res||E'\nPASS signed-in user cannot call the ID helper directly';
  ELSE bad:=bad+1; res:=res||E'\nFAIL helper callable by signed-in user'; END IF;

  -- Pure-function history cases (server context, no table writes)
  EXECUTE 'reset role';
  -- T10 ambiguous history: unchanged passes, changed copy refused
  j := jsonb_build_array(
    jsonb_build_object('type','image','url',H||'public/post_media/u/9.jpg','order',0,'id',A),
    jsonb_build_object('type','image','url',H||'public/post_media/u/9.jpg','order',1,'id',B));
  j2 := public.post_media_assign_ids(j, j);
  err := NULL;
  BEGIN PERFORM public.post_media_assign_ids(j, jsonb_build_array(j->0 || '{"caption":"x"}', j->1));
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF j2=j AND err='post_media_identity_ambiguous' THEN ok:=ok+1; res:=res||E'\nPASS ambiguous history: unchanged passes, changed copy refused';
  ELSE bad:=bad+1; res:=res||E'\nFAIL ambiguous '||coalesce(err,'accepted'); END IF;

  -- T11 grandfathered duplicate passes untouched; changing one copy refused
  j := jsonb_build_array(
    jsonb_build_object('type','image','url',H||'public/post_media/u/a.jpg','order',0,'id',A),
    jsonb_build_object('type','image','url',H||'public/post_media/u/b.jpg','order',1,'id',A),
    jsonb_build_object('type','image','url',H||'public/post_media/u/c.jpg','order',2,'id',C));
  j2 := public.post_media_assign_ids(j, j);
  err := NULL;
  BEGIN PERFORM public.post_media_assign_ids(j, jsonb_build_array(j->0 || '{"caption":"x"}', j->1, j->2));
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF j2=j AND err='post_media_duplicate_id' THEN ok:=ok+1; res:=res||E'\nPASS grandfathered duplicate passes untouched; edited copy refused';
  ELSE bad:=bad+1; res:=res||E'\nFAIL grandfathered dup '||coalesce(err,'accepted'); END IF;

  -- T12 new duplicate refused even while an unrelated old duplicate disappears
  err := NULL;
  BEGIN PERFORM public.post_media_assign_ids(j, jsonb_build_array(j->2,
      jsonb_build_object('type','image','url',H||'public/post_media/u/d.jpg','order',1,'id',D),
      jsonb_build_object('type','image','url',H||'public/post_media/u/e.jpg','order',2,'id',D)));
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err='post_media_duplicate_id' THEN ok:=ok+1; res:=res||E'\nPASS new duplicate refused although an old duplicate disappeared';
  ELSE bad:=bad+1; res:=res||E'\nFAIL swapped duplicate '||coalesce(err,'accepted'); END IF;

  -- T13 uppercase historical ID kept byte-identical, lowercase resend restored to it
  j := jsonb_build_array(jsonb_build_object('type','image','url',H||'public/post_media/u/u.jpg','order',0,'id',UP));
  j2 := public.post_media_assign_ids(j, jsonb_build_array(j->0 || jsonb_build_object('id', lower(UP))));
  IF j2->0->>'id' = UP THEN ok:=ok+1; res:=res||E'\nPASS uppercase saved ID kept byte-identical';
  ELSE bad:=bad+1; res:=res||E'\nFAIL uppercase '||j2::text; END IF;

  -- T14 new video link stores media_id (uppercase client ID, compared case-insensitively)
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4b','c','experience','public', jsonb_build_array(vid || jsonb_build_object('mux_upload_id','p4_b','id',UP))) RETURNING id INTO P2;
  EXECUTE 'reset role';
  SELECT id, media_id::text INTO MID, v FROM public.mux_upload_mappings WHERE mux_upload_id='p4_b';
  IF v = lower(UP) AND (SELECT media->0->>'id' FROM public.posts WHERE id=P2)=UP THEN
    ok:=ok+1; res:=res||E'\nPASS new link stores media_id (case-insensitive match)';
  ELSE bad:=bad+1; res:=res||E'\nFAIL link media_id '||coalesce(v,'null'); END IF;

  -- T15 webhook finds the uppercase-ID item
  UPDATE public.mux_uploads SET status='ready', asset_id='A_B', playback_id='PB_B', duration=8 WHERE upload_id='p4_b';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v := public.patch_content_media_from_mux(MID);
  IF v='patched' AND (SELECT media->0->>'mux_playback_id' FROM public.posts WHERE id=P2)='PB_B' THEN
    ok:=ok+1; res:=res||E'\nPASS webhook matches uppercase media ID';
  ELSE bad:=bad+1; res:=res||E'\nFAIL uppercase webhook '||coalesce(v,'null'); END IF;

  -- T16 old register function (direct insert without media_id) refused; saved link intact
  err := NULL;
  BEGIN
    INSERT INTO public.mux_upload_mappings(mux_upload_id, content_type, content_id, media_index, user_id)
    VALUES ('p4_b','post',P2,0,U);
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err='post_mapping_media_id_required' AND (SELECT status FROM public.mux_upload_mappings WHERE id=MID)='patched' THEN
    ok:=ok+1; res:=res||E'\nPASS old-style insert without media_id refused; saved link intact';
  ELSE bad:=bad+1; res:=res||E'\nFAIL old register '||coalesce(err,'accepted'); END IF;

  -- T17 webhook after position change with a stale slot hint patches the right item
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4c','c','experience','public', jsonb_build_array(vid || '{"mux_upload_id":"p4_c"}',
    jsonb_build_object('type','image','url',H||'public/post_media/u/p.jpg','order',1))) RETURNING id INTO P3;
  SELECT media INTO j FROM public.posts WHERE id=P3;
  UPDATE public.posts SET media = jsonb_build_array(j->1 || '{"order":0}', j->0 || '{"order":1}') WHERE id=P3;
  EXECUTE 'reset role';
  SELECT id INTO MID FROM public.mux_upload_mappings WHERE mux_upload_id='p4_c';
  UPDATE public.mux_upload_mappings SET media_index = 7 WHERE id = MID;  -- stale hint
  SELECT media INTO j FROM public.posts WHERE id=P3;
  UPDATE public.mux_uploads SET status='ready', asset_id='A_C', playback_id='PB_C', duration=8 WHERE upload_id='p4_c';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v := public.patch_content_media_from_mux(MID);
  SELECT media INTO j2 FROM public.posts WHERE id=P3;
  IF v='patched' AND j2->1->>'mux_playback_id'='PB_C' AND j2->0=j->0 THEN
    ok:=ok+1; res:=res||E'\nPASS webhook with stale slot hint patches the right video by ID; photo untouched';
  ELSE bad:=bad+1; res:=res||E'\nFAIL stale hint '||coalesce(v,'null')||' '||j2::text; END IF;

  -- T18 mismatched media_id cannot patch
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4d','c','experience','public', jsonb_build_array(vid || '{"mux_upload_id":"p4_d"}')) RETURNING id INTO P4;
  EXECUTE 'reset role';
  SELECT id INTO MID FROM public.mux_upload_mappings WHERE mux_upload_id='p4_d';
  UPDATE public.mux_upload_mappings SET media_id = gen_random_uuid() WHERE id = MID;
  SELECT media INTO j FROM public.posts WHERE id=P4;
  UPDATE public.mux_uploads SET status='ready', asset_id='A_D', playback_id='PB_D', duration=8 WHERE upload_id='p4_d';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v := public.patch_content_media_from_mux(MID);
  IF v='orphaned' AND (SELECT media FROM public.posts WHERE id=P4)=j THEN
    ok:=ok+1; res:=res||E'\nPASS mismatched media_id not patched; Post unchanged';
  ELSE bad:=bad+1; res:=res||E'\nFAIL mismatched '||coalesce(v,'null'); END IF;

  -- T19 legacy link (media_id NULL) still patches through the slot rule
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4e','c','experience','public', jsonb_build_array(vid || '{"mux_upload_id":"p4_e"}')) RETURNING id INTO P5;
  EXECUTE 'reset role';
  SELECT id INTO MID FROM public.mux_upload_mappings WHERE mux_upload_id='p4_e';
  UPDATE public.mux_upload_mappings SET media_id = NULL WHERE id = MID;
  UPDATE public.mux_uploads SET status='ready', asset_id='A_E', playback_id='PB_E', duration=8 WHERE upload_id='p4_e';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v := public.patch_content_media_from_mux(MID);
  IF v='patched' AND (SELECT media->0->>'mux_playback_id' FROM public.posts WHERE id=P5)='PB_E' THEN
    ok:=ok+1; res:=res||E'\nPASS legacy NULL media_id link patches via slot rule';
  ELSE bad:=bad+1; res:=res||E'\nFAIL legacy '||coalesce(v,'null'); END IF;

  -- T20 late webhook after removal stays noop_removed
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4f','c','experience','public', jsonb_build_array(vid || '{"mux_upload_id":"p4_f"}')) RETURNING id INTO P6;
  UPDATE public.posts SET media = jsonb_build_array(jsonb_build_object('type','image','url',H||'public/post_media/u/q.jpg','order',0)) WHERE id=P6;
  EXECUTE 'reset role';
  SELECT media INTO j FROM public.posts WHERE id=P6;
  SELECT id INTO MID FROM public.mux_upload_mappings WHERE mux_upload_id='p4_f';
  UPDATE public.mux_uploads SET status='ready', asset_id='A_F', playback_id='PB_F', duration=8 WHERE upload_id='p4_f';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v := public.patch_content_media_from_mux(MID);
  IF v='noop_removed' AND (SELECT media FROM public.posts WHERE id=P6)=j THEN
    ok:=ok+1; res:=res||E'\nPASS late webhook after removal: noop_removed, Post unchanged';
  ELSE bad:=bad+1; res:=res||E'\nFAIL late webhook '||coalesce(v,'null'); END IF;

  -- T21 old sync function: a stale shorter/wrong client list is ignored
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4g','c','experience','public', jsonb_build_array(vid || '{"mux_upload_id":"p4_g"}')) RETURNING id INTO P7;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM public.sync_mux_post_mappings(P7, '[]'::jsonb);
  PERFORM public.sync_mux_post_mappings(P7, '[{"mux_upload_id":"p4_b","media_index":0}]'::jsonb);
  SELECT status INTO v FROM public.mux_upload_mappings WHERE mux_upload_id='p4_g';
  SELECT content_id::text INTO v2 FROM public.mux_upload_mappings WHERE mux_upload_id='p4_b';
  IF v='pending' AND v2=P2::text THEN ok:=ok+1; res:=res||E'\nPASS legacy sync ignores stale client lists; saved Post decides';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL legacy sync %s %s', v, v2); END IF;

  -- T22 legacy wrapper on a deleted Post retires links
  UPDATE public.posts SET is_deleted = true WHERE id=P7;
  SELECT public.sync_mux_post_mappings(P7, '[]'::jsonb)->>'post' INTO v;
  SELECT count(*) INTO n FROM public.mux_upload_mappings WHERE content_id=P7 AND status IN ('pending','patched','errored');
  IF v='deleted' AND n=0 THEN ok:=ok+1; res:=res||E'\nPASS legacy wrapper on deleted Post: links retired';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL deleted wrapper %s %s', v, n); END IF;

  -- T23 links CREATED in this run (create/edit/catch-up/wrapper) all carry media_id.
  -- Scope: only this run's new Posts. P5 is excluded on purpose (its link was set
  -- to NULL to model a historical link). Existing historical NULL-media_id links
  -- stay supported and are never expected to gain one.
  SELECT count(*) INTO n FROM public.mux_upload_mappings
   WHERE content_type='post' AND content_id IN (P2,P3,P4,P6) AND status IN ('pending','patched','errored') AND media_id IS NULL;
  IF n=0 THEN ok:=ok+1; res:=res||E'\nPASS links created in this run carry media_id (historical NULL links not in scope)';
  ELSE bad:=bad+1; res:=res||E'\nFAIL new links without media_id '||n; END IF;

  -- T24 lock order in definitions (supporting evidence only)
  v := pg_get_functiondef('public.patch_content_media_from_mux'::regproc);
  v2 := pg_get_functiondef('public.sync_mux_post_mappings'::regproc);
  err := pg_get_functiondef('public.reconcile_post_mux_mappings'::regproc);
  IF position('FROM public.posts WHERE id = v_content_id FOR UPDATE' in v) > 0
     AND position('FROM public.posts WHERE id = v_content_id FOR UPDATE' in v) < position('pg_advisory_xact_lock' in v)
     AND position('pg_advisory_xact_lock' in v) < position('WHERE id = p_mapping_id FOR UPDATE' in v)
     AND position('FOR UPDATE' in v2) < position('sync_mux_post_mappings_core' in v2)
     AND position('FOR UPDATE' in err) < position('sync_mux_post_mappings_core' in err) THEN
    ok:=ok+1; res:=res||E'\nPASS lock order in definitions: Post row, then advisory, then mapping';
  ELSE bad:=bad+1; res:=res||E'\nFAIL lock order text'; END IF;

  -- T25 helper permissions
  SELECT string_agg(f, ',') INTO v FROM unnest(ARRAY['post_media_assign_ids(jsonb,jsonb)','post_media_identity(jsonb)',
      'post_media_storage_key(text)','post_mux_link_items(uuid,jsonb)','sync_mux_post_mappings(uuid,jsonb)']) f
   WHERE has_function_privilege('authenticated','public.'||f,'execute') OR has_function_privilege('anon','public.'||f,'execute')
      OR NOT has_function_privilege('service_role','public.'||f,'execute');
  IF v IS NULL THEN ok:=ok+1; res:=res||E'\nPASS new and changed helpers are service-role only';
  ELSE bad:=bad+1; res:=res||E'\nFAIL grants '||v; END IF;

  -- T26 old duplicate-ID pair [A,B] resent as [A,A] is refused (copy count kept)
  j := jsonb_build_array(
    jsonb_build_object('type','image','url',H||'public/post_media/u/m1.jpg','order',0,'id',A),
    jsonb_build_object('type','image','url',H||'public/post_media/u/m2.jpg','order',1,'id',A));
  err := NULL;
  BEGIN PERFORM public.post_media_assign_ids(j, jsonb_build_array(j->0, j->0 || '{"order":1}'));
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  IF err='post_media_duplicate_id' THEN ok:=ok+1; res:=res||E'\nPASS old duplicate pair [A,B] -> [A,A] refused';
  ELSE bad:=bad+1; res:=res||E'\nFAIL [A,A] '||coalesce(err,'accepted'); END IF;

  -- T27 old duplicate pair with one copy removed is accepted unchanged
  j2 := public.post_media_assign_ids(j, jsonb_build_array(j->0));
  IF j2 = jsonb_build_array(j->0) THEN ok:=ok+1; res:=res||E'\nPASS old duplicate pair with a copy removed accepted unchanged';
  ELSE bad:=bad+1; res:=res||E'\nFAIL copy removal '||j2::text; END IF;

  -- T28 save-time completion (p_patch=false) refuses a link whose media_id does not match its slot item
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4h','c','experience','public', jsonb_build_array(vid || '{"mux_upload_id":"p4_h"}')) RETURNING id INTO P;
  EXECUTE 'reset role';
  SELECT id, status INTO MID, v2 FROM public.mux_upload_mappings WHERE mux_upload_id='p4_h';
  UPDATE public.mux_upload_mappings SET status='pending', patched_at=NULL, media_id=gen_random_uuid() WHERE id=MID;
  PERFORM public.sync_mux_post_mappings_core(P, public.post_mux_link_items(P, (SELECT media FROM public.posts WHERE id=P)), false);
  SELECT status INTO v FROM public.mux_upload_mappings WHERE id=MID;
  IF v2='patched' AND v='pending' THEN
    ok:=ok+1; res:=res||E'\nPASS save-time completion: matching media_id marked done; mismatched media_id left pending';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL save-time completion %s %s', v2, v); END IF;

  -- T29 removed historical (NULL media_id) link reactivated on the same Post gains the current media_id
  PERFORM set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  INSERT INTO public.posts(user_id,title,content,post_type,visibility,media)
  VALUES (U,'p4i','c','experience','public', jsonb_build_array(vid || '{"mux_upload_id":"p4_i"}')) RETURNING id INTO P2;
  UPDATE public.posts SET media = jsonb_build_array(jsonb_build_object('type','image','url',H||'public/post_media/u/r.jpg','order',0)) WHERE id=P2;
  EXECUTE 'reset role';
  UPDATE public.mux_upload_mappings SET media_id = NULL WHERE mux_upload_id='p4_i';
  SELECT id INTO MID FROM public.mux_upload_mappings WHERE mux_upload_id='p4_i';
  EXECUTE 'set local role authenticated';
  UPDATE public.posts SET media = jsonb_build_array(vid || jsonb_build_object('mux_upload_id','p4_i','id',D)) WHERE id=P2;
  EXECUTE 'reset role';
  SELECT status, media_id::text INTO v, v2 FROM public.mux_upload_mappings WHERE mux_upload_id='p4_i';
  SELECT count(*) INTO n FROM public.mux_upload_mappings WHERE mux_upload_id='p4_i';
  IF v='pending' AND v2=D AND n=1 AND (SELECT id FROM public.mux_upload_mappings WHERE mux_upload_id='p4_i')=MID THEN
    ok:=ok+1; res:=res||E'\nPASS removed NULL-media_id link reused on the same Post and gains current media_id';
  ELSE bad:=bad+1; res:=res||format(E'\nFAIL reactivation %s %s %s', v, v2, n); END IF;

  res := res||E'\nBLOCKED simultaneous save-vs-reconcile / save-vs-webhook races (single connection)';
  RAISE EXCEPTION 'POST_VIDEO_PHASE4 % passed, % failed%', ok, bad, res;
END $test$;
