-- Phase 2.4 — Realtime notifications: publication + kill switch.
-- No schema, RLS, grant or trigger changes. The existing
-- "auth.uid() = user_id" SELECT policy already scopes realtime rows server-side.

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Guarded and schema-qualified: re-running must not error, and a same-named
-- table in another schema must not satisfy the check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_publication p ON p.oid = pr.prpubid
      JOIN pg_class c       ON c.oid = pr.prrelid
      JOIN pg_namespace n   ON n.oid = c.relnamespace
     WHERE p.pubname = 'supabase_realtime'
       AND n.nspname = 'public'
       AND c.relname = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Kill switch row. Default ON; admins can disable instantly.
INSERT INTO public.app_config (key, value, description)
SELECT
  'notifications.realtime_enabled',
  '{"enabled": true}'::jsonb,
  'Notification realtime kill switch. When enabled, the notification center opens a user-scoped realtime channel used only as a delivery hint; the unread count RPC and head refresh remain authoritative. When disabled, clients close the channel and fall back to fast polling with no reload.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_config WHERE key = 'notifications.realtime_enabled'
);

-- set_app_flag: allowlist the new key with a strict { "enabled": boolean } shape.
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
    'search_to_draft.non_admin_enabled',
    'entity_extraction.search_image_firecrawl_enabled',
    'entity_extraction.search_image_cse_fallback_enabled',
    'entity_extraction.search_brand_logo_lookup_enabled',
    'notifications.realtime_enabled'
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
  ELSIF _key = 'entity_extraction.search_image_firecrawl_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: entity_extraction.search_image_firecrawl_enabled expects { "enabled": boolean }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'entity_extraction.search_image_cse_fallback_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: entity_extraction.search_image_cse_fallback_enabled expects { "enabled": boolean }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'entity_extraction.search_brand_logo_lookup_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: entity_extraction.search_brand_logo_lookup_enabled expects { "enabled": boolean }'
        USING ERRCODE = '22023';
    END IF;
  ELSIF _key = 'notifications.realtime_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: notifications.realtime_enabled expects { "enabled": boolean }'
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

-- get_public_flags: expose the new flag to ordinary clients (SECURITY DEFINER,
-- so no app_config grant is needed).
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

  SELECT COALESCE((value->>'enabled')::boolean, true)
    INTO notifications_realtime_enabled
    FROM public.app_config WHERE key = 'notifications.realtime_enabled';
  IF notifications_realtime_enabled IS NULL THEN notifications_realtime_enabled := true; END IF;

  RETURN jsonb_build_object(
    'mux', jsonb_build_object(
      'uploads_enabled', uploads_enabled,
      'prewarm_enabled', prewarm_enabled,
      'mode', mode_val
    ),
    'notifications', jsonb_build_object(
      'realtime_enabled', notifications_realtime_enabled
    )
  );
END;
$function$;