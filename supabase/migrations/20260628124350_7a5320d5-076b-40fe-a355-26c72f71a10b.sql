CREATE OR REPLACE FUNCTION public.match_entities_by_name(
  _name text,
  _type text,
  _threshold float DEFAULT 0.55,
  _limit int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  image_url text,
  type text,
  parent_id uuid,
  website_url text,
  api_source text,
  api_ref text,
  metadata jsonb,
  similarity real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT
    e.id, e.name, e.slug, e.image_url, e.type::text,
    e.parent_id, e.website_url, e.api_source, e.api_ref, e.metadata,
    similarity(lower(e.name), lower(_name)) AS similarity
  FROM public.entities e
  WHERE e.is_deleted = false
    AND e.type::text = _type
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND similarity(lower(e.name), lower(_name)) >= _threshold
  ORDER BY similarity DESC
  LIMIT _limit;
$$;

REVOKE ALL ON FUNCTION public.match_entities_by_name(text, text, float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_entities_by_name(text, text, float, int) TO authenticated, service_role;