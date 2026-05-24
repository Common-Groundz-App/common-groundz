
-- Admin-controlled feature flags: app_config table + audit + RPCs

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_reason text
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Admin-only direct access (no public SELECT)
DROP POLICY IF EXISTS "Admins can select app_config" ON public.app_config;
CREATE POLICY "Admins can select app_config"
  ON public.app_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert app_config" ON public.app_config;
CREATE POLICY "Admins can insert app_config"
  ON public.app_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update app_config" ON public.app_config;
CREATE POLICY "Admins can update app_config"
  ON public.app_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete app_config" ON public.app_config;
CREATE POLICY "Admins can delete app_config"
  ON public.app_config FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Audit log
CREATE TABLE IF NOT EXISTS public.app_config_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

ALTER TABLE public.app_config_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select app_config_audit" ON public.app_config_audit;
CREATE POLICY "Admins can select app_config_audit"
  ON public.app_config_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Audit trigger: only fires when value actually changes
CREATE OR REPLACE FUNCTION public.app_config_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.app_config_audit (key, old_value, new_value, changed_by, reason)
    VALUES (NEW.key, OLD.value, NEW.value, NEW.updated_by, NEW.updated_reason);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_config_audit_on_update ON public.app_config;
CREATE TRIGGER app_config_audit_on_update
  AFTER UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.app_config_audit_trigger();

-- Public-safe read RPC: hardcoded allowlist of safe keys only
CREATE OR REPLACE FUNCTION public.get_public_flags()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uploads_enabled boolean;
  mode_val text;
BEGIN
  SELECT COALESCE((value->>'enabled')::boolean, true)
    INTO uploads_enabled
    FROM public.app_config WHERE key = 'mux.uploads_enabled';
  IF uploads_enabled IS NULL THEN uploads_enabled := true; END IF;

  SELECT COALESCE(value->>'mode', 'live')
    INTO mode_val
    FROM public.app_config WHERE key = 'mux.mode';
  IF mode_val IS NULL THEN mode_val := 'live'; END IF;

  RETURN jsonb_build_object(
    'mux', jsonb_build_object(
      'uploads_enabled', uploads_enabled,
      'mode', mode_val
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_flags() TO anon, authenticated;

-- Admin-write RPC: closed key allowlist + per-key validation + idempotent
CREATE OR REPLACE FUNCTION public.set_app_flag(
  _key text,
  _value jsonb,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing jsonb;
  v_keys text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _key NOT IN ('mux.uploads_enabled', 'mux.mode') THEN
    RAISE EXCEPTION 'unknown_key: %', _key USING ERRCODE = '22023';
  END IF;

  -- Guard: jsonb_object_keys assumes an object; reject null/string/array/boolean
  IF _value IS NULL OR jsonb_typeof(_value) <> 'object' THEN
    RAISE EXCEPTION 'invalid_value_for_key: value must be a json object'
      USING ERRCODE = '22023';
  END IF;

  -- Per-key shape validation
  IF _key = 'mux.uploads_enabled' THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(_value) k;
    IF v_keys IS DISTINCT FROM ARRAY['enabled']::text[]
       OR jsonb_typeof(_value->'enabled') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_value_for_key: mux.uploads_enabled expects { "enabled": boolean }'
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

  -- Idempotent
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
$$;

GRANT EXECUTE ON FUNCTION public.set_app_flag(text, jsonb, text) TO authenticated;

-- Seed defaults (idempotent — never overwrite a live admin-set value)
INSERT INTO public.app_config (key, value, description)
VALUES
  ('mux.uploads_enabled', '{"enabled": true}'::jsonb, 'Whether new video uploads go to Mux. When false, uploads fall back to Supabase Storage.'),
  ('mux.mode', '{"mode": "live"}'::jsonb, 'Mux environment for new uploads: "live" or "test".')
ON CONFLICT (key) DO NOTHING;
