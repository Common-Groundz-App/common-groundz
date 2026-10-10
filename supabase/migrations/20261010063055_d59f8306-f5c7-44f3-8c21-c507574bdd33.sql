CREATE OR REPLACE FUNCTION public.media_cleanup_processing_enabled()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT CASE
      WHEN jsonb_typeof(value) = 'boolean' THEN value = 'true'::jsonb
      WHEN jsonb_typeof(value) = 'object' AND jsonb_typeof(value->'enabled') = 'boolean' THEN (value->>'enabled')::boolean
      ELSE false END
    FROM public.app_config WHERE key = 'media_cleanup.processing_enabled'), false);
$$;

CREATE OR REPLACE FUNCTION public.set_app_flag(_key text, _value jsonb, _reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  existing jsonb;
  v_keys text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _key NOT IN (
    'mux.uploads_enabled','mux.mode','mux.prewarm_enabled',
    'entity_extraction.version','entity_extraction.review_uses_draft',
    'entity_extraction.v2_brand_logo_lookup_enabled',
    'entity_creation.non_admin_enabled','search_to_draft.non_admin_enabled',
    'entity_extraction.search_image_firecrawl_enabled',
    'entity_extraction.search_image_cse_fallback_enabled',
    'entity_extraction.search_brand_logo_lookup_enabled',
    'notifications.realtime_enabled',
    'reviews.composer_page_enabled',
    'media_cleanup.processing_enabled'
  ) THEN
    RAISE EXCEPTION 'unknown_key: %', _key USING ERRCODE = '22023';
  END IF;
  IF _value IS NULL OR jsonb_typeof(_value) <> 'object' THEN
    RAISE EXCEPTION 'invalid_value_for_key: value must be a json object' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
  IF _key = 'mux.mode' THEN
    IF v_keys IS DISTINCT FROM ARRAY['mode']::text[] OR (_value->>'mode') NOT IN ('test','live') THEN
      RAISE EXCEPTION 'invalid_value_for_key: mux.mode expects { "mode": "test"|"live" }' USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'entity_extraction.version' THEN
    IF v_keys IS DISTINCT FROM ARRAY['version']::text[] OR (_value->>'version') NOT IN ('v1','v2') THEN
      RAISE EXCEPTION 'invalid_value_for_key: entity_extraction.version expects { "version": "v1"|"v2" }' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[] OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: % expects { "enabled": boolean }', _key USING ERRCODE = '22023';
    END IF;
  END IF;
  SELECT value INTO existing FROM public.app_config WHERE key = _key;
  IF existing IS NOT NULL AND existing = _value THEN
    RETURN jsonb_build_object('changed', false);
  END IF;
  IF existing IS NULL THEN
    INSERT INTO public.app_config (key, value, updated_by, updated_reason)
    VALUES (_key, _value, auth.uid(), _reason);
  ELSE
    UPDATE public.app_config
       SET value = _value, updated_at = now(), updated_by = auth.uid(), updated_reason = _reason
     WHERE key = _key;
  END IF;
  RETURN jsonb_build_object('changed', true, 'previous', existing);
END;
$function$;

CREATE TABLE public.media_deletion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean NOT NULL DEFAULT true,
  report jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.media_deletion_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.media_deletion_runs TO service_role;
ALTER TABLE public.media_deletion_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.media_deletion_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX media_deletion_runs_started_idx ON public.media_deletion_runs (started_at DESC);

CREATE OR REPLACE FUNCTION public.admin_media_deletion_status()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'processing_enabled', public.media_cleanup_processing_enabled(),
    'schedule', (SELECT jsonb_build_object('jobname', jobname, 'schedule', schedule, 'active', active)
                   FROM cron.job WHERE jobname = 'process-media-deletions-hourly' LIMIT 1),
    'runs', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.started_at DESC) FROM
              (SELECT started_at, finished_at, ok, report, error FROM public.media_deletion_runs
                ORDER BY started_at DESC LIMIT 10) x), '[]'::jsonb),
    'counts', COALESCE((SELECT jsonb_object_agg(status, c) FROM
              (SELECT status, count(*) c FROM public.media_deletion_candidates GROUP BY status) s), '{}'::jsonb),
    'failed', (SELECT count(*) FROM public.media_deletion_candidates WHERE status = 'failed'),
    'stuck', (SELECT count(*) FROM public.media_deletion_candidates
               WHERE status = 'deleting' AND lease_until < now() - interval '15 minutes'),
    'retrying', (SELECT count(*) FROM public.media_deletion_candidates WHERE status = 'queued' AND attempts > 0),
    'overdue', (SELECT count(*) FROM public.media_deletion_candidates
               WHERE status = 'queued' AND created_at < now() - interval '3 hours')
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_media_deletion_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_media_deletion_status() TO authenticated;