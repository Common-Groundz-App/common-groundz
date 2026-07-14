CREATE TABLE public.image_enrich_rate_limits (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_enrich_rate_limits TO service_role;

ALTER TABLE public.image_enrich_rate_limits ENABLE ROW LEVEL SECURITY;

-- No user-facing policies. Service role only (bypasses RLS).

CREATE OR REPLACE FUNCTION public.increment_image_enrich_rate_limit(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count int;
BEGIN
  INSERT INTO public.image_enrich_rate_limits (user_id, window_start, count)
  VALUES (_user_id, date_trunc('hour', now()), 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET count = image_enrich_rate_limits.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_image_enrich_rate_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_image_enrich_rate_limit(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.prune_image_enrich_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.image_enrich_rate_limits WHERE window_start < now() - interval '2 hours';
$$;

REVOKE ALL ON FUNCTION public.prune_image_enrich_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_image_enrich_rate_limits() TO service_role;