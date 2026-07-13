-- 1. Rate limit table (service-role only, no RLS policies for user roles).
CREATE TABLE public.search_rate_limits (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_rate_limits TO service_role;
ALTER TABLE public.search_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: table is only accessed by the
-- edge function via service_role, and via the SECURITY DEFINER RPC below.

-- 2. Atomic increment RPC.
CREATE OR REPLACE FUNCTION public.increment_search_rate_limit(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count int;
BEGIN
  INSERT INTO public.search_rate_limits (user_id, window_start, count)
  VALUES (_user_id, date_trunc('hour', now()), 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET count = public.search_rate_limits.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_search_rate_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_search_rate_limit(uuid) TO service_role;

-- 3. Opportunistic cleanup RPC (called ~1% of the time from the edge fn).
CREATE OR REPLACE FUNCTION public.prune_search_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.search_rate_limits
   WHERE window_start < now() - interval '48 hours';
$$;
REVOKE ALL ON FUNCTION public.prune_search_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_search_rate_limits() TO service_role;

-- 4. Seed the new feature flag (OFF by default).
INSERT INTO public.app_config (key, value, description)
VALUES (
  'search_to_draft.non_admin_enabled',
  '{"enabled": false}'::jsonb,
  'When true, non-admin users see the Search tab in Create Entity (Gemini grounded search).'
)
ON CONFLICT (key) DO NOTHING;

-- 5. Read helper mirroring is_non_admin_entity_creation_enabled.
CREATE OR REPLACE FUNCTION public.is_non_admin_search_to_draft_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean
       FROM public.app_config
      WHERE key = 'search_to_draft.non_admin_enabled'),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_non_admin_search_to_draft_enabled() TO anon, authenticated, service_role;

-- 6. Extend set_app_flag allowlist. Preserves every existing branch verbatim;
--    adds the new key + shape validation only.
CREATE OR REPLACE FUNCTION public.set_app_flag(_key text, _value jsonb, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing jsonb;
  v_keys text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _key NOT IN (
    'mux.uploads_enabled',
    'mux.mode',
    'mux.prewarm_enabled',
    'entity_extraction.version',
    'entity_extraction.review_uses_draft',
    'entity_extraction.v2_brand_logo_lookup_enabled',
    'entity_creation.non_admin_enabled',
    'search_to_draft.non_admin_enabled'
  ) THEN
    RAISE EXCEPTION 'unknown_key: %', _key USING ERRCODE = '22023';
  END IF;

  IF _value IS NULL OR jsonb_typeof(_value) <> 'object' THEN
    RAISE EXCEPTION 'invalid_value_for_key: value must be a json object'
      USING ERRCODE = '22023';
  END IF;

  IF _key = 'mux.uploads_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: mux.uploads_enabled expects { "enabled": boolean }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'mux.prewarm_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: mux.prewarm_enabled expects { "enabled": boolean }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'mux.mode' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['mode']::text[]
       OR (_value->>'mode') NOT IN ('test', 'live') THEN
      RAISE EXCEPTION 'invalid_value_for_key: mux.mode expects { "mode": "test"|"live" }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'entity_extraction.version' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['version']::text[]
       OR (_value->>'version') NOT IN ('v1', 'v2') THEN
      RAISE EXCEPTION 'invalid_value_for_key: entity_extraction.version expects { "version": "v1"|"v2" }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'entity_extraction.review_uses_draft' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: entity_extraction.review_uses_draft expects { "enabled": boolean }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'entity_extraction.v2_brand_logo_lookup_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: entity_extraction.v2_brand_logo_lookup_enabled expects { "enabled": boolean }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'entity_creation.non_admin_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: entity_creation.non_admin_enabled expects { "enabled": boolean }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'search_to_draft.non_admin_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: search_to_draft.non_admin_enabled expects { "enabled": boolean }'
        USING ERRCODE = '22023';
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
       SET value = _value,
           updated_at = now(),
           updated_by = auth.uid(),
           updated_reason = _reason
     WHERE key = _key;
  END IF;

  RETURN jsonb_build_object('changed', true, 'previous', existing);
END;
$function$;