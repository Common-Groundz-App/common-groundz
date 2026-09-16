DO $$
DECLARE
  missing text;
  dep_count int;
BEGIN
  -- Guard: all four routines must exist with the expected identity
  SELECT string_agg(sig, ', ') INTO missing
  FROM (VALUES
    ('public.toggle_recommendation_like(uuid, uuid)'),
    ('public.increment_recommendation_view(uuid, uuid)'),
    ('public.get_recommendation_likes_by_ids(uuid[])'),
    ('public.get_user_recommendation_likes(uuid[], uuid)')
  ) AS v(sig)
  WHERE to_regprocedure(v.sig) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 4.5 migration A aborted: expected routine(s) not found: %', missing;
  END IF;

  -- Guard: no trigger may depend on any of these four routines
  SELECT count(*) INTO dep_count
  FROM pg_trigger t
  WHERE NOT t.tgisinternal
    AND t.tgfoid IN (
      to_regprocedure('public.toggle_recommendation_like(uuid, uuid)')::oid,
      to_regprocedure('public.increment_recommendation_view(uuid, uuid)')::oid,
      to_regprocedure('public.get_recommendation_likes_by_ids(uuid[])')::oid,
      to_regprocedure('public.get_user_recommendation_likes(uuid[], uuid)')::oid
    );

  IF dep_count > 0 THEN
    RAISE EXCEPTION 'Phase 4.5 migration A aborted: % trigger dependant(s) found on standalone routines', dep_count;
  END IF;
END $$;

DROP FUNCTION public.toggle_recommendation_like(uuid, uuid);
DROP FUNCTION public.increment_recommendation_view(uuid, uuid);
DROP FUNCTION public.get_recommendation_likes_by_ids(uuid[]);
DROP FUNCTION public.get_user_recommendation_likes(uuid[], uuid);