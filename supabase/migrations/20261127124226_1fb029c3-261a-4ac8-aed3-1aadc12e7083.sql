-- Additional rollback-only database-role tests; not real login sessions.
DO $test$
DECLARE
  rid uuid:=gen_random_uuid();
  author_id uuid:='abfcbf43-b985-40dc-933c-201e5448b794';
  voter_id uuid:='c8508bd3-35a9-4cce-a7c8-0b5fc2bca965';
  n bigint;
  denied boolean;
BEGIN
  BEGIN
    INSERT INTO public.reviews(id,user_id,entity_id,title,rating,category,visibility,status,media)
    VALUES(rid,author_id,'6229a7b9-78ed-4df2-a3bb-f643bd9bf7d6','Phase 11.1 boundary rollback',4,'product','public','published','[]');
    PERFORM set_config('request.jwt.claim.sub','',true);
    PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    denied:=false;
    BEGIN PERFORM public.toggle_review_like(rid,voter_id); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Authenticated role without identity voted'; END IF;
    denied:=false;
    BEGIN PERFORM * FROM public.get_user_review_likes(ARRAY[rid],voter_id); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Authenticated role without identity read viewer state'; END IF;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims','{}',true);
    INSERT INTO public.review_likes(review_id,user_id) VALUES(rid,voter_id);
    UPDATE public.reviews SET status='deleted' WHERE id=rid;
    SELECT count(*) INTO n FROM public.review_likes WHERE review_id=rid;
    IF n<>1 THEN RAISE EXCEPTION 'Status change destroyed historical vote'; END IF;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',voter_id,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    denied:=false;
    BEGIN PERFORM public.toggle_review_like(rid); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Deleted review accepted unvote'; END IF;
    SELECT count(*) INTO n FROM public.get_user_review_likes(ARRAY[rid]);
    IF n<>0 THEN RAISE EXCEPTION 'Deleted viewer state exposed'; END IF;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO n FROM public.get_review_likes_batch(ARRAY[rid]);
    IF n<>0 THEN RAISE EXCEPTION 'Deleted public count exposed'; END IF;
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'intentional rollback' USING ERRCODE='ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN
    RAISE NOTICE 'Phase 11.1: 6 additional boundary assertions passed; fixtures rolled back';
  END;
  IF EXISTS(SELECT 1 FROM public.reviews WHERE id=rid) THEN RAISE EXCEPTION 'Boundary fixture leaked'; END IF;
END $test$;