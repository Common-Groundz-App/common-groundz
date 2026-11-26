DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.reviews WHERE visibility NOT IN ('public','private'))
     OR EXISTS (SELECT 1 FROM public.posts WHERE visibility NOT IN ('public','private')) THEN
    RAISE EXCEPTION 'Phase 10.3 aborted: legacy visibility rows remain';
  END IF;
END $$;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_visibility_check CHECK (visibility IN ('public','private'));
ALTER TABLE public.posts ADD CONSTRAINT posts_visibility_check CHECK (visibility IN ('public','private'));