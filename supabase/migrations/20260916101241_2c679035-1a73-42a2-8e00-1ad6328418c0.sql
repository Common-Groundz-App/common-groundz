-- Verify the table exists before referencing it.
DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RAISE EXCEPTION 'Phase 4.5 migration B aborted: public.reviews not found';
  END IF;
END $$;

-- ALTER TABLE requires this lock anyway; taking it now makes the invariant
-- check and the column drops atomic with respect to concurrent writes.
LOCK TABLE public.reviews IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  marker_rows bigint;
BEGIN
  -- Both legacy columns must still exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.reviews'::regclass
      AND attname = 'recommendation_id' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Phase 4.5 migration B aborted: reviews.recommendation_id not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.reviews'::regclass
      AND attname = 'is_converted' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Phase 4.5 migration B aborted: reviews.is_converted not found';
  END IF;

  -- Re-verify the Gate 4 invariant: zero rows still carry conversion markers.
  SELECT count(*) INTO marker_rows
  FROM public.reviews
  WHERE recommendation_id IS NOT NULL OR is_converted IS TRUE;

  IF marker_rows > 0 THEN
    RAISE EXCEPTION 'Phase 4.5 migration B aborted: % review row(s) still carry conversion markers', marker_rows;
  END IF;

  -- The expected foreign key must exist on reviews.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_recommendation_id_fkey'
      AND conrelid = 'public.reviews'::regclass
  ) THEN
    RAISE EXCEPTION 'Phase 4.5 migration B aborted: reviews_recommendation_id_fkey not found';
  END IF;
END $$;

ALTER TABLE public.reviews DROP CONSTRAINT reviews_recommendation_id_fkey;
ALTER TABLE public.reviews DROP COLUMN recommendation_id;
ALTER TABLE public.reviews DROP COLUMN is_converted;