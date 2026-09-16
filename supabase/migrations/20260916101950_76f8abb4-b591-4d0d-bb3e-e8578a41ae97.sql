-- 1. Verify all expected tables exist before trying to lock them.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recommendation_comments','recommendation_likes','recommendation_saves','recommendations']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Phase 4.5 migration C aborted: public.% not found', t;
    END IF;
  END LOOP;
END $$;

-- 2. Freeze the four retired tables before checking destructive invariants.
LOCK TABLE public.recommendation_comments, public.recommendation_likes, public.recommendation_saves, public.recommendations IN ACCESS EXCLUSIVE MODE;

-- 3. Re-check emptiness and surviving dependencies while locked.
DO $$
DECLARE
  t text;
  n bigint;
  dep int;
BEGIN
  FOREACH t IN ARRAY ARRAY['recommendation_comments','recommendation_likes','recommendation_saves','recommendations']
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Phase 4.5 migration C aborted: % still has % row(s)', t, n;
    END IF;
  END LOOP;

  -- No view/materialized view may depend on a retired table.
  SELECT count(*) INTO dep
  FROM pg_rewrite rw
  JOIN pg_class v ON v.oid = rw.ev_class AND v.relkind IN ('v','m')
  JOIN pg_depend d ON d.objid = rw.oid AND d.classid = 'pg_rewrite'::regclass
  WHERE d.refobjid IN (
    'public.recommendation_comments'::regclass,
    'public.recommendation_likes'::regclass,
    'public.recommendation_saves'::regclass,
    'public.recommendations'::regclass
  );
  IF dep > 0 THEN
    RAISE EXCEPTION 'Phase 4.5 migration C aborted: % view(s) depend on the retired tables', dep;
  END IF;

  -- No surviving-table FK may point into the retired layer
  -- (FKs among the retired tables themselves are expected and drop with them).
  SELECT count(*) INTO dep
  FROM pg_constraint
  WHERE contype = 'f'
    AND confrelid IN (
      'public.recommendation_comments'::regclass,
      'public.recommendation_likes'::regclass,
      'public.recommendation_saves'::regclass,
      'public.recommendations'::regclass
    )
    AND conrelid NOT IN (
      'public.recommendation_comments'::regclass,
      'public.recommendation_likes'::regclass,
      'public.recommendation_saves'::regclass,
      'public.recommendations'::regclass
    );
  IF dep > 0 THEN
    RAISE EXCEPTION 'Phase 4.5 migration C aborted: % surviving-table FK(s) point into the retired tables', dep;
  END IF;
END $$;

DROP TABLE public.recommendation_comments;
DROP TABLE public.recommendation_likes;
DROP TABLE public.recommendation_saves;
DROP TABLE public.recommendations;