-- 1. Seed the new flag row (idempotent)
INSERT INTO public.app_config (key, value, description)
VALUES (
  'mux.prewarm_enabled',
  '{"enabled": true}'::jsonb,
  'Controls HLS prewarm-on-tap optimization. Does NOT affect Mux uploads or video playback — only the on-tap prefetch of manifest/first segment.'
)
ON CONFLICT (key) DO NOTHING;

-- 2. Extend public flags reader
CREATE OR REPLACE FUNCTION public.get_public_flags()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uploads_enabled boolean;
  prewarm_enabled boolean;
  mode_val text;
BEGIN
  SELECT COALESCE((value->>'enabled')::boolean, true)
    INTO uploads_enabled
    FROM public.app_config WHERE key = 'mux.uploads_enabled';
  IF uploads_enabled IS NULL THEN uploads_enabled := true; END IF;

  SELECT COALESCE((value->>'enabled')::boolean, true)
    INTO prewarm_enabled
    FROM public.app_config WHERE key = 'mux.prewarm_enabled';
  IF prewarm_enabled IS NULL THEN prewarm_enabled := true; END IF;

  SELECT COALESCE(value->>'mode', 'live')
    INTO mode_val
    FROM public.app_config WHERE key = 'mux.mode';
  IF mode_val IS NULL THEN mode_val := 'live'; END IF;

  RETURN jsonb_build_object(
    'mux', jsonb_build_object(
      'uploads_enabled', uploads_enabled,
      'prewarm_enabled', prewarm_enabled,
      'mode', mode_val
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_flags() TO anon, authenticated;

-- 3. Extend admin flag-writer allowlist
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

  IF _key NOT IN ('mux.uploads_enabled', 'mux.mode', 'mux.prewarm_enabled') THEN
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