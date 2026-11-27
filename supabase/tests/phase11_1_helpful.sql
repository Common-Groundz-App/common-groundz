-- Administrator-run database-role regression; NOT real Supabase login sessions.
-- All fixtures and mutations roll back, including on a failed assertion.
-- No trigger bypasses, permanent harness, credentials or external media.
-- Successful execution raises a NOTICE containing the actual assertion count.
DO $test$
DECLARE
  author_id uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  voter_id uuid := 'c8508bd3-35a9-4cce-a7c8-0b5fc2bca965';
  other_id uuid := '06261a67-ebd7-43db-afe2-c3218e118473';
  rid uuid := gen_random_uuid();
  missing_id uuid := gen_random_uuid();
  n bigint;
  b boolean;
  denied boolean;
  statement text;
  passed integer := 0;
  review_before text;
  policy_before text;
  votes_before bigint;
BEGIN
  SELECT count(*) INTO votes_before FROM public.review_likes;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY id)::text,'')) INTO review_before FROM public.reviews r;
  SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname)::text) INTO policy_before
    FROM pg_policies p WHERE schemaname='public' AND tablename IN ('reviews','review_updates','posts');
  BEGIN
    IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=author_id)
       OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=voter_id)
       OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=other_id) THEN
      RAISE EXCEPTION 'Named test accounts missing';
    END IF;
    INSERT INTO public.reviews(id,user_id,entity_id,title,rating,category,visibility,status,media)
      VALUES(rid,author_id,'6229a7b9-78ed-4df2-a3bb-f643bd9bf7d6','Phase 11.1 rollback-only test',4,'product','public','published','[]');

    -- Guest cannot enumerate voters or execute either identity-bearing RPC.
    PERFORM set_config('request.jwt.claim.sub','',true);
    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    EXECUTE 'SET LOCAL ROLE anon';
    FOREACH statement IN ARRAY ARRAY[
      'SELECT * FROM public.review_likes',
      format('SELECT public.toggle_review_like(%L::uuid)',rid),
      format('SELECT * FROM public.get_user_review_likes(ARRAY[%L::uuid])',rid)
    ] LOOP
      denied:=false;
      BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
      IF NOT denied THEN RAISE EXCEPTION 'Guest access accepted: %',statement; END IF;
      passed:=passed+1;
    END LOOP;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',voter_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF auth.uid() IS DISTINCT FROM voter_id THEN RAISE EXCEPTION 'Wrong database-role identity'; END IF;
    -- Identity spoofing is rejected for writes AND viewer-state reads.
    FOREACH statement IN ARRAY ARRAY[
      format('SELECT public.toggle_review_like(%L::uuid,%L::uuid)',rid,author_id),
      format('SELECT * FROM public.get_user_review_likes(ARRAY[%L::uuid],%L::uuid)',rid,author_id),
      format('SELECT public.toggle_review_like(%L::uuid)',missing_id)
    ] LOOP
      denied:=false;
      BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
      IF NOT denied THEN RAISE EXCEPTION 'Unauthorized RPC accepted: %',statement; END IF;
      passed:=passed+1;
    END LOOP;
    SELECT public.toggle_review_like(rid) INTO b;
    IF b IS DISTINCT FROM true THEN RAISE EXCEPTION 'Optional voter omitted: add failed'; END IF;
    passed:=passed+1;
    SELECT count(*) INTO n FROM public.get_user_review_likes(ARRAY[rid]);
    IF n<>1 THEN RAISE EXCEPTION 'Own selected state missing'; END IF;
    passed:=passed+1;
    SELECT count(*) INTO n FROM public.review_likes WHERE review_id=rid;
    IF n<>1 THEN RAISE EXCEPTION 'Own direct read missing'; END IF;
    passed:=passed+1;
    -- Denied writes must not silently affect existing rows, including UPDATE/DELETE.
    FOREACH statement IN ARRAY ARRAY[
      format('INSERT INTO public.review_likes(review_id,user_id) VALUES(%L,%L)',rid,voter_id),
      format('UPDATE public.review_likes SET user_id=%L WHERE review_id=%L',other_id,rid),
      format('DELETE FROM public.review_likes WHERE review_id=%L',rid)
    ] LOOP
      denied:=false;
      BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
      IF NOT denied THEN RAISE EXCEPTION 'Direct write accepted: %',statement; END IF;
      passed:=passed+1;
    END LOOP;
    EXECUTE 'RESET ROLE';
    -- The existing database uniqueness constraint remains effective for backend writes.
    denied:=false;
    BEGIN INSERT INTO public.review_likes(review_id,user_id) VALUES(rid,voter_id);
    EXCEPTION WHEN unique_violation THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Duplicate vote accepted'; END IF;
    passed:=passed+1;
    IF EXISTS(SELECT 1 FROM public.reviews WHERE id=rid AND (rating<>4 OR is_recommended IS DISTINCT FROM true)) THEN
      RAISE EXCEPTION 'Helpful changed rating/recommendation';
    END IF;
    passed:=passed+1;

    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.review_likes WHERE review_id=rid;
    IF n<>0 THEN RAISE EXCEPTION 'Other voter identity exposed'; END IF;
    passed:=passed+1;
    SELECT count(*) INTO n FROM public.get_user_review_likes(ARRAY[rid]);
    IF n<>0 THEN RAISE EXCEPTION 'Other viewer selection exposed'; END IF;
    passed:=passed+1;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',author_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    denied:=false;
    BEGIN PERFORM public.toggle_review_like(rid); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Self-vote accepted'; END IF;
    passed:=passed+1;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT like_count INTO n FROM public.get_review_likes_batch(ARRAY[rid]);
    IF n IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Guest public aggregate missing'; END IF;
    passed:=passed+1;
    EXECUTE 'RESET ROLE';

    -- Admin fixture manipulation only; same parent triggers run, no trigger bypass.
    PERFORM set_config('request.jwt.claims','{}',true);
    UPDATE public.reviews SET visibility='private' WHERE id=rid;
    SELECT count(*) INTO n FROM public.review_likes WHERE review_id=rid;
    IF n<>1 THEN RAISE EXCEPTION 'Private transition destroyed vote'; END IF;
    passed:=passed+1;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',voter_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    denied:=false;
    BEGIN PERFORM public.toggle_review_like(rid); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Private unvote accepted'; END IF;
    passed:=passed+1;
    SELECT count(*) INTO n FROM public.get_user_review_likes(ARRAY[rid]);
    IF n<>0 THEN RAISE EXCEPTION 'Private selected state leaked'; END IF;
    passed:=passed+1;
    SELECT count(*) INTO n FROM public.review_likes WHERE review_id=rid;
    IF n<>0 THEN RAISE EXCEPTION 'Private own vote history leaked'; END IF;
    passed:=passed+1;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    denied:=false;
    BEGIN PERFORM public.toggle_review_like(rid); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'New private vote accepted'; END IF;
    passed:=passed+1;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO n FROM public.get_review_likes_batch(ARRAY[rid]);
    IF n<>0 THEN RAISE EXCEPTION 'Known-ID private count leaked'; END IF;
    passed:=passed+1;
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claims','{}',true);
    UPDATE public.reviews SET visibility='public',status='draft' WHERE id=rid;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',voter_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    denied:=false;
    BEGIN PERFORM public.toggle_review_like(rid); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Draft unvote accepted'; END IF;
    passed:=passed+1;
    SELECT count(*) INTO n FROM public.get_review_likes_batch(ARRAY[rid]);
    IF n<>0 THEN RAISE EXCEPTION 'Draft count leaked'; END IF;
    passed:=passed+1;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims','{}',true);
    UPDATE public.reviews SET status='published' WHERE id=rid;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',voter_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT like_count INTO n FROM public.get_review_likes_batch(ARRAY[rid]);
    IF n IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Restored public count wrong'; END IF;
    passed:=passed+1;
    SELECT count(*) INTO n FROM public.get_user_review_likes(ARRAY[rid],voter_id);
    IF n<>1 THEN RAISE EXCEPTION 'Restored viewer selected state wrong'; END IF;
    passed:=passed+1;
    SELECT public.toggle_review_like(rid,voter_id) INTO b;
    IF b IS DISTINCT FROM false THEN RAISE EXCEPTION 'Matching legacy caller unvote failed'; END IF;
    passed:=passed+1;
    SELECT public.toggle_review_like(rid,NULL) INTO b;
    IF b IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit null legacy caller add failed'; END IF;
    passed:=passed+1;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims','{}',true);
    DELETE FROM public.reviews WHERE id=rid;
    SELECT count(*) INTO n FROM public.review_likes WHERE review_id=rid;
    IF n<>0 THEN RAISE EXCEPTION 'Authorized parent delete cascade failed'; END IF;
    passed:=passed+1;
    RAISE EXCEPTION 'intentional fixture rollback' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN
    RAISE NOTICE 'Phase 11.1 database-role assertions passed: %; fixtures rolled back',passed;
  END;
  IF (SELECT count(*) FROM public.review_likes)<>votes_before THEN RAISE EXCEPTION 'Vote fixture leaked'; END IF;
  IF (SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY id)::text,'')) FROM public.reviews r) IS DISTINCT FROM review_before THEN
    RAISE EXCEPTION 'Review fixture mutation leaked'; END IF;
  IF (SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname)::text) FROM pg_policies p
      WHERE schemaname='public' AND tablename IN ('reviews','review_updates','posts')) IS DISTINCT FROM policy_before THEN
    RAISE EXCEPTION 'Phase 10 policies changed'; END IF;
END $test$;