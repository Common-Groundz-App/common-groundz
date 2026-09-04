CREATE TABLE IF NOT EXISTS public._stage1_test_results (
  id bigserial PRIMARY KEY,
  check_name text NOT NULL,
  result text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public._stage1_test_results ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public._stage1_test_results TO service_role;

-- TEMPORARY verification harness — dropped immediately after evidence capture.
-- Functional self-test ONLY. Deliberately contains no SET ROLE: role and privilege
-- denial cannot be honestly proven from inside a SECURITY DEFINER function, so those
-- checks run from real sessions as those roles, separately. Concurrency likewise
-- cannot be proven from one session and is reported UNVERIFIED here.
CREATE OR REPLACE FUNCTION public._stage1_selftest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  -- Fixture ids verified before execution: entity is an active entity of type 'brand'
  -- (matching the review category the subject trigger enforces) and both users exist.
  -- The fixture review is created and deleted within this single transaction.
  v_user_a uuid := 'ff397c4b-dcb1-4154-8dd5-d3ec573502d3';
  v_user_b uuid := 'abfcbf43-b985-40dc-933c-201e5448b794';
  v_entity uuid := '9f1997f1-1ce7-47a0-9b39-918d7c99cc38';
  v_review uuid;
  v_u1 uuid; v_u2 uuid; v_u3 uuid; v_u4 uuid; v_u5 uuid;
  v_res   jsonb;
  v_txt   text;
  v_num   numeric;
  v_int   integer;
  v_rec   boolean;   -- is_recommended
  v_flag  boolean;   -- has_timeline
  v_ts    timestamptz;
  v_bad   timestamptz := '2001-01-01T00:00:00Z';
  r record;
BEGIN
  DELETE FROM public._stage1_test_results;

  -- ==========================================================================
  -- A. RESOLVER TRUTH TABLE (shared fixture, mirrored in TypeScript)
  -- ==========================================================================
  FOR r IN
    WITH cases(name, envelope, category, latest, rating, exp_intent, exp_source, exp_rec) AS (VALUES
     ('resolver: timeline yes beats envelope no', '{"version":"1","type":"movie","answers":{"would_recommend":"no"}}'::jsonb,'movie','yes',1::numeric,'yes','timeline_explicit',true),
     ('resolver: timeline maybe -> false', '{"version":"1","type":"movie","answers":{"would_recommend":"yes"}}'::jsonb,'movie','maybe',5,'maybe','timeline_explicit',false),
     ('resolver: timeline no', NULL,'movie','no',5,'no','timeline_explicit',false),
     ('resolver: auto discards envelope, low rating', '{"version":"1","type":"movie","answers":{"would_recommend":"yes"}}'::jsonb,'movie','auto',2,NULL,'rating_inferred',false),
     ('resolver: auto discards envelope, high rating', '{"version":"1","type":"movie","answers":{"would_recommend":"no"}}'::jsonb,'movie','auto',4,NULL,'rating_inferred',true),
     ('resolver: envelope yes', '{"version":"1","type":"movie","answers":{"would_recommend":"yes"}}'::jsonb,'movie',NULL,1,'yes','review_explicit',true),
     ('resolver: envelope maybe -> false', '{"version":"1","type":"movie","answers":{"would_recommend":"maybe"}}'::jsonb,'movie',NULL,5,'maybe','review_explicit',false),
     ('resolver: envelope no', '{"version":"1","type":"movie","answers":{"would_recommend":"no"}}'::jsonb,'movie',NULL,5,'no','review_explicit',false),
     ('resolver: wrong version -> absent', '{"version":"2","type":"movie","answers":{"would_recommend":"yes"}}'::jsonb,'movie',NULL,2,NULL,'rating_inferred',false),
     ('resolver: type mismatch -> absent', '{"version":"1","type":"book","answers":{"would_recommend":"yes"}}'::jsonb,'movie',NULL,2,NULL,'rating_inferred',false),
     ('resolver: answers not object -> absent', '{"version":"1","type":"movie","answers":"yes"}'::jsonb,'movie',NULL,5,NULL,'rating_inferred',true),
     ('resolver: junk answer -> absent not false', '{"version":"1","type":"movie","answers":{"would_recommend":"probably"}}'::jsonb,'movie',NULL,5,NULL,'rating_inferred',true),
     ('resolver: envelope is array -> absent', '[]'::jsonb,'movie',NULL,2,NULL,'rating_inferred',false),
     ('resolver: null category never matches', '{"version":"1","type":"movie","answers":{"would_recommend":"yes"}}'::jsonb,NULL,NULL,2,NULL,'rating_inferred',false),
     ('resolver: rating 4 -> true', NULL,'movie',NULL,4,NULL,'rating_inferred',true),
     ('resolver: rating 3.9 -> false', NULL,'movie',NULL,3.9,NULL,'rating_inferred',false),
     ('resolver: null rating -> false', NULL,'movie',NULL,NULL,NULL,'rating_inferred',false)
    )
    SELECT c.name,
      CASE WHEN COALESCE(d->>'intent','~') = COALESCE(c.exp_intent,'~')
            AND d->>'source' = c.exp_source
            AND (d->>'is_recommended')::boolean = c.exp_rec
       THEN 'PASS' ELSE 'FAIL' END AS result,
      'got intent=' || COALESCE(d->>'intent','null') || ' source=' || (d->>'source') ||
      ' rec=' || (d->>'is_recommended') AS detail
    FROM cases c, LATERAL (SELECT public.resolve_review_recommendation(c.envelope, c.category, c.latest, c.rating) AS d) x
  LOOP
    INSERT INTO public._stage1_test_results(check_name, result, detail) VALUES (r.name, r.result, r.detail);
  END LOOP;

  -- ==========================================================================
  -- B. FIXTURE: a throwaway review owned by user A
  -- ==========================================================================
  INSERT INTO public.reviews (title, rating, category, user_id, entity_id, metadata)
  VALUES ('STAGE1 SELFTEST', 5, 'brand', v_user_a, v_entity,
          '{"questionnaire":{"version":"1","type":"brand","answers":{"would_recommend":"no"}}}'::jsonb)
  RETURNING id INTO v_review;

  SELECT is_recommended INTO v_rec FROM public.reviews WHERE id = v_review;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('reviews trigger: envelope "no" beats rating 5',
          CASE WHEN v_rec IS FALSE THEN 'PASS' ELSE 'FAIL' END,
          'is_recommended=' || v_rec::text);

  -- ==========================================================================
  -- C. SERVER-OWNED CHRONOLOGY
  -- The trigger uses now(), i.e. transaction_timestamp(); asserting against a later
  -- clock_timestamp() captured here would produce a false failure.
  -- ==========================================================================
  INSERT INTO public.review_updates (review_id, user_id, comment, rating, created_at, would_recommend)
  VALUES (v_review, v_user_a, 'u1', 3, v_bad, 'yes')
  RETURNING id, created_at INTO v_u1, v_ts;

  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('chronology: client created_at did not survive; stored value is server-generated',
          CASE WHEN v_ts <> v_bad AND v_ts = transaction_timestamp()
          THEN 'PASS' ELSE 'FAIL' END,
          'submitted=' || v_bad::text || ' persisted=' || v_ts::text ||
          ' transaction_timestamp=' || transaction_timestamp()::text);

  SELECT would_recommend INTO v_txt FROM public.review_updates WHERE id = v_u1;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('insert path: would_recommend is writable',
          CASE WHEN v_txt = 'yes' THEN 'PASS' ELSE 'FAIL' END, 'stored=' || COALESCE(v_txt,'null'));

  SELECT latest_rating, timeline_count, has_timeline, is_recommended
    INTO v_num, v_int, v_flag, v_rec
  FROM public.reviews WHERE id = v_review;

  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('recompute: first insert sets count/latest_rating/has_timeline',
          CASE WHEN v_int = 1 AND v_num = 3 AND v_flag IS TRUE THEN 'PASS' ELSE 'FAIL' END,
          'count=' || v_int || ' latest_rating=' || COALESCE(v_num::text,'null') ||
          ' has_timeline=' || v_flag::text);

  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('resolver via trigger: timeline "yes" overrides envelope "no"',
          CASE WHEN v_rec IS TRUE THEN 'PASS' ELSE 'FAIL' END, 'is_recommended=' || v_rec::text);

  -- ==========================================================================
  -- D. DETERMINISTIC TIE-BREAK
  -- NOTE: the direct UPDATE/DELETE statements below are TEST-ONLY PRIVILEGED FIXTURE
  -- MANIPULATION, used solely to force an exact timestamp tie. They are never part of
  -- the application mutation path, which is RPC-only, and this harness is dropped once
  -- the evidence is captured.
  -- ==========================================================================
  INSERT INTO public.review_updates (review_id, user_id, comment, would_recommend)
  VALUES (v_review, v_user_a, 'tie-a', 'no') RETURNING id INTO v_u2;
  INSERT INTO public.review_updates (review_id, user_id, comment, would_recommend)
  VALUES (v_review, v_user_a, 'tie-b', 'yes') RETURNING id INTO v_u3;

  UPDATE public.review_updates SET created_at = '2030-01-01T00:00:00Z'   -- test-only fixture
   WHERE id IN (v_u2, v_u3);

  SELECT would_recommend INTO v_txt FROM public.review_updates WHERE id = GREATEST(v_u2, v_u3);
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('tie-break: identical created_at resolved by id DESC',
          CASE WHEN public.lookup_latest_recommendation_intent(v_review) = v_txt
          THEN 'PASS' ELSE 'FAIL' END,
          'resolved=' || COALESCE(public.lookup_latest_recommendation_intent(v_review),'null') ||
          ' expected(greater id)=' || COALESCE(v_txt,'null'));

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text, true);

  SELECT public.delete_latest_review_update(v_review, LEAST(v_u2, v_u3)) INTO v_res;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('tie-break: LIFO uses the same (created_at, id) ordering',
          CASE WHEN v_res->>'status' = 'conflict'
                AND v_res->>'latestUpdateId' = GREATEST(v_u2, v_u3)::text
          THEN 'PASS' ELSE 'FAIL' END, v_res::text);

  DELETE FROM public.review_updates WHERE id IN (v_u2, v_u3);   -- test-only fixture teardown
  PERFORM public.recompute_review_timeline_state(v_review);

  -- ==========================================================================
  -- E. LIFO UNDO
  -- ==========================================================================
  INSERT INTO public.review_updates (review_id, user_id, comment, rating, would_recommend)
  VALUES (v_review, v_user_a, 'u2', 5, 'no') RETURNING id INTO v_u2;
  INSERT INTO public.review_updates (review_id, user_id, comment)
  VALUES (v_review, v_user_a, 'u3') RETURNING id INTO v_u3;
  INSERT INTO public.review_updates (review_id, user_id, comment, would_recommend)
  VALUES (v_review, v_user_a, 'u4', 'auto') RETURNING id INTO v_u4;
  INSERT INTO public.review_updates (review_id, user_id, comment)
  VALUES (v_review, v_user_a, 'u5') RETURNING id INTO v_u5;

  SELECT is_recommended INTO v_rec FROM public.reviews WHERE id = v_review;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('timeline: latest "auto" falls back to rating (latest_rating 5)',
          CASE WHEN v_rec IS TRUE THEN 'PASS' ELSE 'FAIL' END, 'is_recommended=' || v_rec::text);

  SELECT public.delete_latest_review_update(v_review, v_u3) INTO v_res;
  SELECT COUNT(*) INTO v_int FROM public.review_updates WHERE review_id = v_review;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('LIFO: undoing the 3rd of 5 returns conflict and deletes nothing',
          CASE WHEN v_res->>'status' = 'conflict' AND v_res->>'latestUpdateId' = v_u5::text
                AND v_int = 5 THEN 'PASS' ELSE 'FAIL' END,
          v_res::text || ' remaining=' || v_int);

  SELECT public.delete_latest_review_update(v_review, gen_random_uuid()) INTO v_res;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('LIFO: stale expected id returns conflict + latestUpdateId',
          CASE WHEN v_res->>'status' = 'conflict' AND v_res->>'latestUpdateId' = v_u5::text
          THEN 'PASS' ELSE 'FAIL' END, v_res::text);

  SELECT public.delete_latest_review_update(v_review, v_u5) INTO v_res;
  SELECT COUNT(*) INTO v_int FROM public.review_updates WHERE review_id = v_review;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('LIFO: undoing the newest deletes exactly one row',
          CASE WHEN v_res->>'status' = 'deleted' AND v_res->>'deletedUpdateId' = v_u5::text
                AND v_res->>'latestUpdateId' = v_u4::text AND v_int = 4
          THEN 'PASS' ELSE 'FAIL' END, v_res::text || ' remaining=' || v_int);

  SELECT public.delete_latest_review_update(v_review, v_u4) INTO v_res;
  SELECT public.lookup_latest_recommendation_intent(v_review) INTO v_txt;
  SELECT is_recommended INTO v_rec FROM public.reviews WHERE id = v_review;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('LIFO: undoing "auto" restores the previous explicit intent',
          CASE WHEN v_txt = 'no' AND v_rec IS FALSE THEN 'PASS' ELSE 'FAIL' END,
          'intent=' || COALESCE(v_txt,'null') || ' is_recommended=' || v_rec::text);

  SELECT public.delete_latest_review_update(v_review, v_u3) INTO v_res;
  SELECT public.delete_latest_review_update(v_review, v_u2) INTO v_res;
  SELECT latest_rating INTO v_num FROM public.reviews WHERE id = v_review;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('recompute: latest_rating falls back to the previous rated update',
          CASE WHEN v_num = 3 THEN 'PASS' ELSE 'FAIL' END,
          'latest_rating=' || COALESCE(v_num::text,'null'));

  SELECT public.delete_latest_review_update(v_review, v_u1) INTO v_res;
  SELECT latest_rating, timeline_count, has_timeline, is_recommended
    INTO v_num, v_int, v_flag, v_rec
  FROM public.reviews WHERE id = v_review;

  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('recompute: emptying the timeline clears has_timeline/count/latest_rating',
          CASE WHEN v_flag IS FALSE AND v_int = 0 AND v_num IS NULL THEN 'PASS' ELSE 'FAIL' END,
          'has_timeline=' || v_flag::text || ' count=' || v_int ||
          ' latest_rating=' || COALESCE(v_num::text,'null'));

  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('resolver: empty timeline restores envelope authority ("no")',
          CASE WHEN v_rec IS FALSE THEN 'PASS' ELSE 'FAIL' END, 'is_recommended=' || v_rec::text);

  SELECT public.delete_latest_review_update(v_review, gen_random_uuid()) INTO v_res;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('LIFO: empty timeline returns not_found',
          CASE WHEN v_res->>'status' = 'not_found' THEN 'PASS' ELSE 'FAIL' END, v_res::text);

  -- ==========================================================================
  -- F. UNDO RPC AUTHORIZATION (auth.uid() based, no SET ROLE involved)
  -- ==========================================================================
  INSERT INTO public.review_updates (review_id, user_id, comment, would_recommend)
  VALUES (v_review, v_user_a, 'owned', 'yes') RETURNING id INTO v_u1;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user_b::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.delete_latest_review_update(v_review, v_u1);
    INSERT INTO public._stage1_test_results(check_name, result, detail)
    VALUES ('authorization: non-owner undo', 'FAIL', 'no exception raised');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO public._stage1_test_results(check_name, result, detail)
    VALUES ('authorization: non-owner undo raises a database error', 'PASS', SQLERRM);
  END;

  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    PERFORM public.delete_latest_review_update(v_review, v_u1);
    INSERT INTO public._stage1_test_results(check_name, result, detail)
    VALUES ('authorization: unauthenticated undo', 'FAIL', 'no exception raised');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO public._stage1_test_results(check_name, result, detail)
    VALUES ('authorization: unauthenticated undo raises a database error', 'PASS', SQLERRM);
  END;

  -- ==========================================================================
  -- G. MAINTENANCE RPC BEHAVIOUR (including the lost-race result contract)
  -- ==========================================================================
  SELECT public.admin_delete_review_update(gen_random_uuid()) INTO v_res;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('maintenance: unknown id returns not_found',
          CASE WHEN v_res->>'status' = 'not_found' THEN 'PASS' ELSE 'FAIL' END, v_res::text);

  SELECT public.admin_delete_review_update(v_u1) INTO v_res;
  SELECT timeline_count, has_timeline INTO v_int, v_flag FROM public.reviews WHERE id = v_review;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('maintenance: deletes the row and recomputes',
          CASE WHEN v_res->>'status' = 'deleted' AND v_int = 0 AND v_flag IS FALSE
          THEN 'PASS' ELSE 'FAIL' END, v_res::text || ' count=' || v_int);

  SELECT public.admin_delete_review_update(v_u1) INTO v_res;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('maintenance: already-removed row returns not_found, never a false deleted',
          CASE WHEN v_res->>'status' = 'not_found' THEN 'PASS' ELSE 'FAIL' END, v_res::text);

  -- ==========================================================================
  -- H. NO RECURSION ON UNRELATED REVIEW UPDATES
  -- ==========================================================================
  UPDATE public.reviews SET subtitle = 'unrelated change' WHERE id = v_review;
  SELECT timeline_count, has_timeline INTO v_int, v_flag FROM public.reviews WHERE id = v_review;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('recursion: unrelated column update completes and keeps derived state',
          CASE WHEN v_int = 0 AND v_flag IS FALSE THEN 'PASS' ELSE 'FAIL' END,
          'count=' || v_int || ' has_timeline=' || v_flag::text);

  -- ==========================================================================
  -- I. RLS ENABLED
  -- ==========================================================================
  SELECT relrowsecurity INTO v_flag FROM pg_class WHERE oid = 'public.review_updates'::regclass;
  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('RLS is enabled on review_updates',
          CASE WHEN v_flag THEN 'PASS' ELSE 'FAIL' END, 'relrowsecurity=' || v_flag::text);

  -- ==========================================================================
  -- CLEANUP (test-only privileged teardown of this harness's own fixture)
  -- ==========================================================================
  DELETE FROM public.review_updates WHERE review_id = v_review;
  DELETE FROM public.reviews WHERE id = v_review;

  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('cleanup: test review removed',
          CASE WHEN NOT EXISTS (SELECT 1 FROM public.reviews WHERE id = v_review)
          THEN 'PASS' ELSE 'FAIL' END, v_review::text);

  INSERT INTO public._stage1_test_results(check_name, result, detail)
  VALUES ('concurrency (insert vs undo, undo vs undo, maintenance vs undo, two reviews)',
          'UNVERIFIED', 'requires independent parallel sessions; not provable from a single-session self-test');
END;
$fn$;

ALTER FUNCTION public._stage1_selftest() OWNER TO postgres;
REVOKE ALL ON FUNCTION public._stage1_selftest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._stage1_selftest() TO service_role;