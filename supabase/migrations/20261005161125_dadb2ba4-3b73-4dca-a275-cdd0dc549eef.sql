INSERT INTO public.app_config (key, value, description)
VALUES ('reviews.composer_page_enabled', '{"enabled": false}'::jsonb, 'Step 3 rollout: route review authoring to the full-page composer. Default off (legacy popup).')
ON CONFLICT (key) DO NOTHING;

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
    'mux.uploads_enabled','mux.mode','mux.prewarm_enabled',
    'entity_extraction.version','entity_extraction.review_uses_draft',
    'entity_extraction.v2_brand_logo_lookup_enabled',
    'entity_creation.non_admin_enabled','search_to_draft.non_admin_enabled',
    'entity_extraction.search_image_firecrawl_enabled',
    'entity_extraction.search_image_cse_fallback_enabled',
    'entity_extraction.search_brand_logo_lookup_enabled',
    'notifications.realtime_enabled',
    'reviews.composer_page_enabled'
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
  notifications_realtime_enabled boolean;
  composer_page_enabled boolean;
BEGIN
  SELECT COALESCE((value->>'enabled')::boolean, true) INTO uploads_enabled FROM public.app_config WHERE key = 'mux.uploads_enabled';
  IF uploads_enabled IS NULL THEN uploads_enabled := true; END IF;
  SELECT COALESCE((value->>'enabled')::boolean, true) INTO prewarm_enabled FROM public.app_config WHERE key = 'mux.prewarm_enabled';
  IF prewarm_enabled IS NULL THEN prewarm_enabled := true; END IF;
  SELECT COALESCE(value->>'mode', 'live') INTO mode_val FROM public.app_config WHERE key = 'mux.mode';
  IF mode_val IS NULL THEN mode_val := 'live'; END IF;
  SELECT COALESCE((value->>'enabled')::boolean, true) INTO notifications_realtime_enabled FROM public.app_config WHERE key = 'notifications.realtime_enabled';
  IF notifications_realtime_enabled IS NULL THEN notifications_realtime_enabled := true; END IF;

  SELECT CASE WHEN jsonb_typeof(value->'enabled') = 'boolean' THEN (value->>'enabled')::boolean ELSE false END
    INTO composer_page_enabled
    FROM public.app_config WHERE key = 'reviews.composer_page_enabled';
  IF composer_page_enabled IS NULL THEN composer_page_enabled := false; END IF;

  RETURN jsonb_build_object(
    'mux', jsonb_build_object('uploads_enabled', uploads_enabled, 'prewarm_enabled', prewarm_enabled, 'mode', mode_val),
    'notifications', jsonb_build_object('realtime_enabled', notifications_realtime_enabled),
    'reviews', jsonb_build_object('composer_page_enabled', composer_page_enabled)
  );
END;
$function$;