ALTER TABLE public.media_views DROP CONSTRAINT media_views_source_check;
ALTER TABLE public.media_views ADD CONSTRAINT media_views_source_check CHECK (source = ANY (ARRAY['post','review','entity','review_update']));

CREATE OR REPLACE FUNCTION public.admin_review_video_view_stats(_source text DEFAULT NULL, _source_id uuid DEFAULT NULL)
RETURNS TABLE(source text, qualified_views bigint, registered_viewers bigint, anonymous_sessions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF _source IS NOT NULL AND _source NOT IN ('review','review_update') THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;
  IF _source_id IS NOT NULL AND _source IS NULL THEN
    RAISE EXCEPTION 'source is required when source_id is provided' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT mv.source,
         count(DISTINCT (coalesce(mv.user_id::text, 'a:' || mv.anon_session_id), mv.source_id, mv.media_path)),
         count(DISTINCT mv.user_id),
         count(DISTINCT mv.anon_session_id) FILTER (WHERE mv.user_id IS NULL)
  FROM public.media_views mv
  WHERE mv.source IN ('review','review_update')
    AND (_source IS NULL OR mv.source = _source)
    AND (_source_id IS NULL OR mv.source_id = _source_id)
  GROUP BY mv.source;
END $$;

REVOKE ALL ON FUNCTION public.admin_review_video_view_stats(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_video_view_stats(text, uuid) TO authenticated;