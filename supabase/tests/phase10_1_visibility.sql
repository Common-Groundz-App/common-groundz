-- Phase 10.1 database-role authorization regression, not real signed-in sessions.
-- Run through the migration tool (or an administrator's SQL Editor).
-- No fixtures, policy changes, trigger bypasses, or permanent test objects.
-- Each assertion fails the transaction on regression. Real browser sessions remain
-- separately unverified when external Supabase cannot provide a sandbox session.
DO $test$
DECLARE
  review_snapshot jsonb;
  post_snapshot jsonb;
  canonical_snapshot jsonb;
  follow_snapshot jsonb;
  policy_before text;
  u uuid;
  label text;
  expected_ids uuid[];
  actual_ids uuid[];
  expected_endorsements jsonb;
  actual_endorsements jsonb;
  authors uuid[];
  one_way_authors uuid[];
  expected_count integer;
  actual_count integer;
  passed integer := 0;
  denied boolean;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.reviews'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.posts'::regclass) THEN
    RAISE EXCEPTION 'RLS must remain enabled';
  END IF;
  SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname)::text)
    INTO policy_before FROM pg_policies p
    WHERE schemaname='public' AND tablename IN ('reviews','posts');
  SELECT jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'visibility',visibility))
    INTO review_snapshot FROM public.reviews;
  SELECT jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'visibility',visibility,'is_deleted',is_deleted))
    INTO post_snapshot FROM public.posts;
  SELECT jsonb_agg(to_jsonb(f)) INTO follow_snapshot FROM public.follows f;
  SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY created_at DESC NULLS LAST,entity_id,user_id),'[]'::jsonb)
    INTO canonical_snapshot FROM (
      SELECT user_id,entity_id,effective_rating,created_at FROM (
        SELECT DISTINCT ON (user_id,entity_id)
          user_id,entity_id,is_recommended,coalesce(latest_rating,rating::numeric) AS effective_rating,created_at
        FROM public.reviews WHERE visibility='public' AND status='published' AND entity_id IS NOT NULL
        ORDER BY user_id,entity_id,created_at DESC NULLS LAST,id DESC
      ) current_reviews WHERE is_recommended IS TRUE
    ) c;
  -- Fail instead of silently passing an empty-data permission test.
  IF (SELECT count(*) FROM public.reviews WHERE visibility='private') < 2
     OR NOT EXISTS (SELECT 1 FROM public.posts WHERE visibility='private' AND NOT is_deleted)
     OR NOT EXISTS (SELECT 1 FROM public.posts WHERE visibility='public' AND is_deleted) THEN
    RAISE EXCEPTION 'Required private/soft-deleted real test records missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reviews
    WHERE id='b03b4226-b59f-43c4-a8ec-56d64a858a41' AND visibility='public' AND status='published'
      AND md5((to_jsonb(reviews)-'visibility'-'updated_at')::text)='7bf920d0cb75ffce4b719892e35e7620') THEN
    RAISE EXCEPTION 'Converted Nandi Hills review must remain published and otherwise identical';
  END IF;
  passed := passed + 1;

  FOR label,u IN SELECT * FROM (VALUES
    ('guest',NULL::uuid),
    ('Rishabh','c8508bd3-35a9-4cce-a7c8-0b5fc2bca965'::uuid),
    ('Hana/private owner','abfcbf43-b985-40dc-933c-201e5448b794'::uuid),
    ('unrelated viewer','06261a67-ebd7-43db-afe2-c3218e118473'::uuid),
    ('second private owner','d765341b-ae02-4308-ae16-284809c9051b'::uuid)
  ) scenarios(label,u)
  LOOP
    PERFORM set_config('request.jwt.claim.sub','',true);
    PERFORM set_config('request.jwt.claim.role','',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role',CASE WHEN u IS NULL THEN 'anon' ELSE 'authenticated' END)::text,true);
    IF u IS NULL THEN EXECUTE 'SET LOCAL ROLE anon';
    ELSE EXECUTE 'SET LOCAL ROLE authenticated'; END IF;
    IF auth.uid() IS DISTINCT FROM u THEN RAISE EXCEPTION 'Wrong test identity for %',label; END IF;

    -- R1: Public reviews accessible; every non-public review author-only.
    SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO expected_ids
      FROM jsonb_to_recordset(review_snapshot) AS r(id uuid,user_id uuid,visibility text)
      WHERE visibility='public' OR user_id=u;
    EXECUTE 'SELECT coalesce(array_agg(id ORDER BY id),''{}''::uuid[]) FROM public.reviews' INTO actual_ids;
    IF actual_ids IS DISTINCT FROM expected_ids THEN RAISE EXCEPTION '%: review access mismatch',label; END IF;
    passed := passed + 1;

    -- R2: Public posts preserve NOT is_deleted; all private posts author-only.
    -- Existing owner policy deliberately still allows the owner's deleted rows.
    SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO expected_ids
      FROM jsonb_to_recordset(post_snapshot) AS p(id uuid,user_id uuid,visibility text,is_deleted boolean)
      WHERE (visibility='public' AND NOT is_deleted) OR user_id=u;
    EXECUTE 'SELECT coalesce(array_agg(id ORDER BY id),''{}''::uuid[]) FROM public.posts' INTO actual_ids;
    IF actual_ids IS DISTINCT FROM expected_ids THEN RAISE EXCEPTION '%: post access mismatch',label; END IF;
    passed := passed + 1;

    IF u IS NULL THEN
      -- R3: Guests cannot execute the personalized SECURITY DEFINER RPC.
      denied := false;
      BEGIN
        PERFORM * FROM public.get_canonical_endorsements_for_viewer('c8508bd3-35a9-4cce-a7c8-0b5fc2bca965');
      EXCEPTION WHEN insufficient_privilege THEN denied := true;
      END;
      IF NOT denied THEN RAISE EXCEPTION 'Guest RPC execution was not denied'; END IF;
      passed := passed + 1;
    ELSE
      -- R4: No private review seeds endorsements, even for its owner.
      SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY created_at DESC NULLS LAST,entity_id,user_id),'[]'::jsonb)
        INTO actual_endorsements FROM public.get_canonical_endorsements_for_viewer(u,NULL,NULL,NULL,2000) e;
      IF actual_endorsements IS DISTINCT FROM canonical_snapshot THEN
        RAISE EXCEPTION '%: public-only canonical endorsement mismatch',label;
      END IF;
      passed := passed + 1;

      -- R5: Circle's existing author filter uses outgoing follows only.
      SELECT coalesce(array_agg(following_id),'{}'::uuid[]) INTO authors
        FROM jsonb_to_recordset(follow_snapshot) AS f(follower_id uuid,following_id uuid) WHERE follower_id=u;
      SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY created_at DESC NULLS LAST,entity_id,user_id),'[]'::jsonb)
        INTO expected_endorsements FROM jsonb_to_recordset(canonical_snapshot)
        AS e(user_id uuid,entity_id uuid,effective_rating numeric,created_at timestamptz) WHERE user_id=ANY(authors);
      SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY created_at DESC NULLS LAST,entity_id,user_id),'[]'::jsonb)
        INTO actual_endorsements FROM public.get_canonical_endorsements_for_viewer(u,authors,NULL,NULL,2000) e;
      IF actual_endorsements IS DISTINCT FROM expected_endorsements THEN RAISE EXCEPTION '%: followed-author mismatch',label; END IF;
      passed := passed + 1;

      -- R6: Caller cannot impersonate another viewer (ACL plus auth.uid check).
      denied := false;
      BEGIN
        PERFORM * FROM public.get_canonical_endorsements_for_viewer(
          CASE WHEN u='c8508bd3-35a9-4cce-a7c8-0b5fc2bca965' THEN 'abfcbf43-b985-40dc-933c-201e5448b794'::uuid
               ELSE 'c8508bd3-35a9-4cce-a7c8-0b5fc2bca965'::uuid END);
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM='not authorized' THEN denied := true; ELSE RAISE; END IF;
      END;
      IF NOT denied THEN RAISE EXCEPTION '%: spoofed viewer was accepted',label; END IF;
      passed := passed + 1;

      -- R7: Empty author set returns nothing; no fallback to all public reviews.
      SELECT count(*) INTO actual_count FROM public.get_canonical_endorsements_for_viewer(u,'{}'::uuid[]);
      IF actual_count <> 0 THEN RAISE EXCEPTION '%: empty author filter ignored',label; END IF;
      passed := passed + 1;

      -- R8: Existing limit clamping and time filter remain intact.
      SELECT count(*) INTO actual_count FROM public.get_canonical_endorsements_for_viewer(u,NULL,NULL,NULL,0);
      IF actual_count <> least(1,jsonb_array_length(canonical_snapshot)) THEN RAISE EXCEPTION '%: limit changed',label; END IF;
      SELECT count(*) INTO actual_count FROM public.get_canonical_endorsements_for_viewer(u,NULL,NULL,now()+interval '1 day');
      IF actual_count <> 0 THEN RAISE EXCEPTION '%: time filter ignored',label; END IF;
      passed := passed + 1;

      -- R9: Nandi Hills public review returned once, including Hana's Circle.
      SELECT count(*) INTO actual_count FROM public.get_canonical_endorsements_for_viewer(
        u,ARRAY['c8508bd3-35a9-4cce-a7c8-0b5fc2bca965'::uuid],ARRAY['ddd6416d-aade-48fe-a3b8-2370e4ef9843'::uuid]);
      IF actual_count <> 1 THEN RAISE EXCEPTION '%: Nandi Hills endorsement missing or duplicated',label; END IF;
      passed := passed + 1;
    END IF;
    EXECUTE 'RESET ROLE';
  END LOOP;

  -- R10: Non-mutual follows are exercised with real published endorsements.
  SELECT f.follower_id,array_agg(DISTINCT f.following_id) INTO u,one_way_authors
  FROM public.follows f JOIN public.reviews r ON r.user_id=f.following_id
  WHERE r.visibility='public' AND r.status='published' AND r.is_recommended AND r.entity_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.follows b WHERE b.follower_id=f.following_id AND b.following_id=f.follower_id)
  GROUP BY f.follower_id ORDER BY f.follower_id LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'One-way-follow endorsement fixture missing'; END IF;
  SELECT count(*) INTO expected_count FROM jsonb_to_recordset(canonical_snapshot)
    AS e(user_id uuid,entity_id uuid,effective_rating numeric,created_at timestamptz) WHERE user_id=ANY(one_way_authors);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO actual_count FROM public.get_canonical_endorsements_for_viewer(u,one_way_authors,NULL,NULL,2000);
  IF expected_count < 1 OR actual_count <> expected_count THEN RAISE EXCEPTION 'Follow-back must not be required'; END IF;
  EXECUTE 'RESET ROLE';
  passed := passed + 1;

  -- R11: Signature privileges and security characteristics unchanged.
  IF has_function_privilege('anon','public.get_canonical_endorsements_for_viewer(uuid,uuid[],uuid[],timestamptz,integer)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.get_canonical_endorsements_for_viewer(uuid,uuid[],uuid[],timestamptz,integer)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.get_canonical_endorsements_for_viewer(uuid,uuid[],uuid[],timestamptz,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC grants changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.get_canonical_endorsements_for_viewer(uuid,uuid[],uuid[],timestamptz,integer)'::regprocedure
    AND prosecdef AND provolatile='s' AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=public']) THEN
    RAISE EXCEPTION 'RPC security characteristics changed';
  END IF;
  passed := passed + 1;

  -- R12: Zero policy/write-protection changes from verification.
  IF policy_before IS DISTINCT FROM (SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname)::text)
    FROM pg_policies p WHERE schemaname='public' AND tablename IN ('reviews','posts')) THEN
    RAISE EXCEPTION 'Review/post policies changed';
  END IF;
  passed := passed + 1;
  IF passed <> 39 THEN RAISE EXCEPTION 'Expected 39 completed scenario checks, got %',passed; END IF;
  PERFORM set_config('request.jwt.claims','{}',true);
  RAISE NOTICE 'Phase 10.1: 39 database-role checks passed; no persistent fixtures or authorization changes.';
END;
$test$;