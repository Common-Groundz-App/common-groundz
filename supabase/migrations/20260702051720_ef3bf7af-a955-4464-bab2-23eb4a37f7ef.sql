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
    'entity_extraction.v2_brand_logo_lookup_enabled'
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

INSERT INTO public.app_config (key, value, description)
SELECT
  'entity_extraction.v2_brand_logo_lookup_enabled',
  '{"enabled": true}'::jsonb,
  'V2 Brand Logo Parity kill-switch. When enabled, analyze-entity-url-v2 actively enriches suggested-new brand candidates with Google CSE-based logo lookup + own-origin favicon fallback under a 4s global budget. Admin-only.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_config WHERE key = 'entity_extraction.v2_brand_logo_lookup_enabled'
);