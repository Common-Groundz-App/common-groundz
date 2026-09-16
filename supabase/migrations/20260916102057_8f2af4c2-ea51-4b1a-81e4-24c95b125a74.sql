DO $$
DECLARE
  missing text;
  dep_count int;
BEGIN
  -- All three trigger functions must still exist.
  SELECT string_agg(sig, ', ') INTO missing
  FROM (VALUES
    ('public.create_recommendation_comment_notification()'),
    ('public.create_recommendation_like_notification()'),
    ('public.retract_recommendation_like_notification()')
  ) AS v(sig)
  WHERE to_regprocedure(v.sig) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 4.5 migration D aborted: expected routine(s) not found: %', missing;
  END IF;

  -- Their trigger instances dropped with the retired tables; no trigger may remain.
  SELECT count(*) INTO dep_count
  FROM pg_trigger t
  WHERE NOT t.tgisinternal
    AND t.tgfoid IN (
      to_regprocedure('public.create_recommendation_comment_notification()')::oid,
      to_regprocedure('public.create_recommendation_like_notification()')::oid,
      to_regprocedure('public.retract_recommendation_like_notification()')::oid
    );

  IF dep_count > 0 THEN
    RAISE EXCEPTION 'Phase 4.5 migration D aborted: % trigger dependant(s) still reference the trigger functions', dep_count;
  END IF;
END $$;

DROP FUNCTION public.create_recommendation_comment_notification();
DROP FUNCTION public.create_recommendation_like_notification();
DROP FUNCTION public.retract_recommendation_like_notification();