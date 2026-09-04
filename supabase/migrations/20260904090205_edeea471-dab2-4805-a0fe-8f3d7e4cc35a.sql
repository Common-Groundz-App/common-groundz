DO $priv$
DECLARE
  v_entity uuid := '9f1997f1-1ce7-47a0-9b39-918d7c99cc38';
  v_owner uuid := 'ff397c4b-dcb1-4154-8dd5-d3ec573502d3';
  v_other uuid := 'e4406792-7e64-481e-8be0-25acbd161236';
  v_review uuid;
  v_update uuid;
  v_rows int;
  v_result jsonb;
BEGIN
  ----------------------------------------------------------------------------
  -- Fixture
  ----------------------------------------------------------------------------
  INSERT INTO public.reviews (user_id, entity_id, title, rating, category, status, metadata)
  VALUES (v_owner, v_entity, 'stage1 closeout fixture', 3, 'brand', 'published',
          jsonb_build_object('questionnaire', jsonb_build_object('version', 1, 'type', 'brand',
                             'answers', jsonb_build_object('would_recommend', 'no'))))
  RETURNING id INTO v_review;

  INSERT INTO public.review_updates (review_id, user_id, rating, comment, would_recommend)
  VALUES (v_review, v_owner, 5, 'closeout fixture update', 'yes')
  RETURNING id INTO v_update;

  ----------------------------------------------------------------------------
  -- A. anon direct mutation denial
  ----------------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE anon;
    EXECUTE format('UPDATE public.review_updates SET comment = %L WHERE id = %L', 'hacked', v_update);
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('anon direct UPDATE review_updates', 'FAIL', 'statement was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('anon direct UPDATE review_updates', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    SET LOCAL ROLE anon;
    EXECUTE format('DELETE FROM public.review_updates WHERE id = %L', v_update);
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('anon direct DELETE review_updates', 'FAIL', 'statement was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('anon direct DELETE review_updates', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    SET LOCAL ROLE anon;
    EXECUTE 'TRUNCATE public.review_updates';
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('anon TRUNCATE review_updates', 'FAIL', 'statement was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('anon TRUNCATE review_updates', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  ----------------------------------------------------------------------------
  -- B. authenticated direct mutation denial
  ----------------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE authenticated;
    EXECUTE format('UPDATE public.review_updates SET comment = %L WHERE id = %L', 'hacked', v_update);
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('authenticated direct UPDATE review_updates', 'FAIL', 'statement was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('authenticated direct UPDATE review_updates', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    SET LOCAL ROLE authenticated;
    EXECUTE format('DELETE FROM public.review_updates WHERE id = %L', v_update);
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('authenticated direct DELETE review_updates', 'FAIL', 'statement was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('authenticated direct DELETE review_updates', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    SET LOCAL ROLE authenticated;
    EXECUTE 'TRUNCATE public.review_updates';
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('authenticated TRUNCATE review_updates', 'FAIL', 'statement was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('authenticated TRUNCATE review_updates', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  ----------------------------------------------------------------------------
  -- C. service_role direct mutation denial (Option A)
  ----------------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE service_role;
    EXECUTE format('UPDATE public.review_updates SET comment = %L WHERE id = %L', 'hacked', v_update);
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('service_role direct UPDATE review_updates', 'FAIL', 'statement was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('service_role direct UPDATE review_updates', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  BEGIN
    SET LOCAL ROLE service_role;
    EXECUTE format('DELETE FROM public.review_updates WHERE id = %L', v_update);
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('service_role direct DELETE review_updates', 'FAIL', 'statement was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('service_role direct DELETE review_updates', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  SELECT count(*) INTO v_rows FROM public.review_updates WHERE id = v_update;
  INSERT INTO public._stage1_closeout_results(check_name, status, detail)
  VALUES ('fixture update survived all denied statements',
          CASE WHEN v_rows = 1 THEN 'PASS' ELSE 'FAIL' END, 'rows=' || v_rows);

  ----------------------------------------------------------------------------
  -- D. maintenance RPC privilege matrix
  ----------------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE service_role;
    v_result := public.admin_delete_review_update(v_update);
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('service_role maintenance RPC allowed',
            CASE WHEN v_result->>'status' = 'deleted' THEN 'PASS' ELSE 'FAIL' END, v_result::text);
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('service_role maintenance RPC allowed', 'FAIL', SQLSTATE || ' ' || SQLERRM);
  END;

  SELECT count(*) INTO v_rows FROM public.review_updates WHERE id = v_update;
  INSERT INTO public._stage1_closeout_results(check_name, status, detail)
  VALUES ('maintenance RPC removed exactly the fixture row',
          CASE WHEN v_rows = 0 THEN 'PASS' ELSE 'FAIL' END, 'rows=' || v_rows);

  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.admin_delete_review_update(v_update);
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('authenticated maintenance RPC denied', 'FAIL', 'execute was allowed');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public._stage1_closeout_results(check_name, status, detail)
    VALUES ('authenticated maintenance RPC denied', 'PASS', SQLSTATE || ' ' || SQLERRM);
  END;

  ----------------------------------------------------------------------------
  -- E. Cleanup
  ----------------------------------------------------------------------------
  DELETE FROM public.review_updates WHERE review_id = v_review;
  DELETE FROM public.reviews WHERE id = v_review;

  SELECT count(*) INTO v_rows FROM public.reviews WHERE id = v_review;
  INSERT INTO public._stage1_closeout_results(check_name, status, detail)
  VALUES ('fixture cleaned up', CASE WHEN v_rows = 0 THEN 'PASS' ELSE 'FAIL' END, 'rows=' || v_rows);
END;
$priv$;