-- =====================================================================
-- Phase 3.4A — server rails for non-admin entity creation
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Trigger: race-safe quota + forced pending for non-admins
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.entities_enforce_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin       boolean := false;
  used_count     integer;
  quota_max      constant integer := 10;
  quota_window   constant interval := interval '24 hours';
BEGIN
  -- Client sessions: force created_by to the authenticated caller
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  -- Service-role inserts MUST supply created_by explicitly
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'created_by is required' USING ERRCODE = '23502';
  END IF;

  is_admin := public.has_role(NEW.created_by, 'admin'::public.app_role);

  IF is_admin THEN
    NEW.approval_status   := 'approved';
    NEW.approved_by       := NEW.created_by;
    NEW.approved_at       := now();
    NEW.rejected_by       := NULL;
    NEW.rejected_at       := NULL;
    NEW.rejection_reason  := NULL;
  ELSE
    -- Race-safe quota: serialize concurrent inserts by the same user
    PERFORM pg_advisory_xact_lock(hashtext('entity_quota:' || NEW.created_by::text));

    SELECT count(*) INTO used_count
      FROM public.entities
     WHERE created_by = NEW.created_by
       AND is_deleted = false
       AND created_at > now() - quota_window;

    IF used_count >= quota_max THEN
      RAISE EXCEPTION 'entity_creation_quota_exceeded'
        USING ERRCODE = '23514',
              HINT = 'Non-admin users can create up to 10 entities per 24h.';
    END IF;

    NEW.approval_status   := 'pending';
    NEW.approved_by       := NULL;
    NEW.approved_at       := NULL;
    NEW.rejected_by       := NULL;
    NEW.rejected_at       := NULL;
    NEW.rejection_reason  := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger binding already exists from prior migration; recreate defensively.
DROP TRIGGER IF EXISTS entities_enforce_creation ON public.entities;
CREATE TRIGGER entities_enforce_creation
BEFORE INSERT ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.entities_enforce_creation();

-- ---------------------------------------------------------------------
-- 2) Drop old boolean quota RPC, add new JSON status RPC under a new name
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.check_entity_creation_quota(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_entity_creation_quota_status(
  _user_id        uuid,
  _max_entities   integer DEFAULT 10,
  _window_hours   integer DEFAULT 24,
  _required_count integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used_count integer;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() <> _user_id
         AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO used_count
    FROM public.entities
   WHERE created_by = _user_id
     AND is_deleted = false
     AND created_at > now() - make_interval(hours => _window_hours);

  RETURN jsonb_build_object(
    'used',      used_count,
    'max',       _max_entities,
    'remaining', greatest(_max_entities - used_count, 0),
    'required',  _required_count,
    'allowed',   (_max_entities - used_count) >= _required_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_entity_creation_quota_status(uuid, integer, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_entity_creation_quota_status(uuid, integer, integer, integer)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) URL validation helper — top-level, IMMUTABLE, no elevated privs
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_entity_http_url(
  _url        text,
  _field_name text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t text;
BEGIN
  IF _url IS NULL THEN RETURN NULL; END IF;

  t := btrim(_url);

  IF t = '' THEN RETURN NULL; END IF;

  IF length(t) > 2048 THEN
    RAISE EXCEPTION 'invalid_url_%_too_long', _field_name USING ERRCODE = '22023';
  END IF;

  IF t !~* '^https?://[^ \t\r\n]+$' THEN
    RAISE EXCEPTION 'invalid_url_%', _field_name USING ERRCODE = '22023';
  END IF;

  RETURN t;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_entity_http_url(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validate_entity_http_url(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) Atomic brand + entity creator
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_brand_and_entity_atomic(
  _brand_name         text,
  _entity_name        text,
  _entity_type        public.entity_type,
  _brand_website_url  text  DEFAULT NULL,
  _brand_image_url    text  DEFAULT NULL,
  _brand_description  text  DEFAULT NULL,
  _entity_category_id uuid  DEFAULT NULL,
  _entity_description text  DEFAULT NULL,
  _entity_website_url text  DEFAULT NULL,
  _entity_image_url   text  DEFAULT NULL,
  _entity_metadata    jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid              uuid := auth.uid();
  is_admin         boolean;
  normalized_brand text;
  normalized_web   text;
  existing_brand   public.entities%ROWTYPE;
  soft_deleted     public.entities%ROWTYPE;
  website_owner    public.entities%ROWTYPE;
  brand_base_slug  text;
  brand_slug       text;
  entity_base_slug text;
  entity_slug      text;
  candidate_slug   text;
  new_brand        public.entities%ROWTYPE;
  new_entity       public.entities%ROWTYPE;
  safe_meta        jsonb;
  found_slot       boolean;
BEGIN
  -- 1. Auth
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  is_admin := public.has_role(uid, 'admin'::public.app_role);

  -- 2. Feature-flag gate (non-admins only)
  IF NOT is_admin AND NOT public.is_non_admin_entity_creation_enabled() THEN
    RAISE EXCEPTION 'non_admin_entity_creation_disabled' USING ERRCODE = '42501';
  END IF;

  -- 3. Payload validation
  IF _brand_name IS NULL OR length(btrim(_brand_name)) < 2 OR length(_brand_name) > 200 THEN
    RAISE EXCEPTION 'invalid_brand_name' USING ERRCODE = '22023';
  END IF;
  IF _entity_name IS NULL OR length(btrim(_entity_name)) < 2 OR length(_entity_name) > 300 THEN
    RAISE EXCEPTION 'invalid_entity_name' USING ERRCODE = '22023';
  END IF;
  IF _entity_type = 'brand'::public.entity_type THEN
    RAISE EXCEPTION 'entity_type_cannot_be_brand' USING ERRCODE = '22023';
  END IF;

  -- 4. URL normalization via top-level helper
  _brand_website_url  := public.validate_entity_http_url(_brand_website_url,  'brand_website');
  _brand_image_url    := public.validate_entity_http_url(_brand_image_url,    'brand_image');
  _entity_website_url := public.validate_entity_http_url(_entity_website_url, 'entity_website');
  _entity_image_url   := public.validate_entity_http_url(_entity_image_url,   'entity_image');

  -- 5. Metadata sanitize + cap
  IF _entity_metadata IS NULL THEN
    safe_meta := '{}'::jsonb;
  ELSIF pg_column_size(_entity_metadata) > 32000 THEN
    RAISE EXCEPTION 'metadata_too_large' USING ERRCODE = '22023';
  ELSE
    safe_meta := _entity_metadata
      - 'approval_status' - 'approved_by' - 'approved_at'
      - 'rejected_by' - 'rejected_at' - 'is_deleted'
      - 'created_by' - 'restored' - 'restored_by' - 'restored_at';
  END IF;

  normalized_brand := lower(btrim(_brand_name));
  normalized_web   := _brand_website_url;

  -- 6. Serialize concurrent inserts for the same brand name
  PERFORM pg_advisory_xact_lock(hashtext('brand_create:' || normalized_brand));

  -- 7. Duplicate re-check inside the transaction
  SELECT * INTO existing_brand
    FROM public.entities
   WHERE type = 'brand'::public.entity_type
     AND is_deleted = false
     AND lower(name) = normalized_brand
   LIMIT 1;

  IF existing_brand.id IS NOT NULL THEN
    new_brand := existing_brand;
  ELSE
    SELECT * INTO soft_deleted
      FROM public.entities
     WHERE type = 'brand'::public.entity_type
       AND is_deleted = true
       AND lower(name) = normalized_brand
     LIMIT 1;
    IF soft_deleted.id IS NOT NULL THEN
      RAISE EXCEPTION 'conflict_requires_admin_soft_deleted_brand' USING ERRCODE = 'P0001';
    END IF;

    IF normalized_web IS NOT NULL THEN
      SELECT * INTO website_owner
        FROM public.entities
       WHERE type = 'brand'::public.entity_type
         AND website_url = normalized_web
       LIMIT 1;
      IF website_owner.id IS NOT NULL THEN
        RAISE EXCEPTION 'conflict_requires_admin_website_owned' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- 8. Brand slug base loop
    brand_base_slug := btrim(regexp_replace(lower(_brand_name), '[^a-z0-9]+', '-', 'g'), '-');
    IF brand_base_slug = '' THEN brand_base_slug := 'brand'; END IF;
    found_slot := false;
    FOR i IN 0..20 LOOP
      candidate_slug := CASE WHEN i = 0 THEN brand_base_slug
                             ELSE brand_base_slug || '-' || i::text END;
      IF NOT EXISTS (
        SELECT 1 FROM public.entities
         WHERE slug = candidate_slug AND is_deleted = false
      ) THEN
        brand_slug := candidate_slug;
        found_slot := true;
        EXIT;
      END IF;
    END LOOP;
    IF NOT found_slot THEN
      RAISE EXCEPTION 'slug_generation_failed_brand' USING ERRCODE = 'P0001';
    END IF;

    -- 9. Insert brand (whitelist; trigger enforces quota + pending)
    INSERT INTO public.entities (
      name, type, slug, image_url, website_url, description,
      created_by, user_created, metadata
    ) VALUES (
      _brand_name,
      'brand'::public.entity_type,
      brand_slug,
      _brand_image_url,
      normalized_web,
      coalesce(_brand_description, _brand_name || ' brand'),
      uid,
      true,
      jsonb_build_object(
        'auto_created', true,
        'creation_method', 'atomic_brand_plus_entity'
      )
    )
    RETURNING * INTO new_brand;
  END IF;

  -- 10. Entity slug base loop
  entity_base_slug := btrim(regexp_replace(lower(_entity_name), '[^a-z0-9]+', '-', 'g'), '-');
  IF entity_base_slug = '' THEN entity_base_slug := 'entity'; END IF;
  found_slot := false;
  FOR i IN 0..20 LOOP
    candidate_slug := CASE WHEN i = 0 THEN entity_base_slug
                           ELSE entity_base_slug || '-' || i::text END;
    IF NOT EXISTS (
      SELECT 1 FROM public.entities
       WHERE slug = candidate_slug AND is_deleted = false
    ) THEN
      entity_slug := candidate_slug;
      found_slot := true;
      EXIT;
    END IF;
  END LOOP;
  IF NOT found_slot THEN
    RAISE EXCEPTION 'slug_generation_failed_entity' USING ERRCODE = 'P0001';
  END IF;

  -- 11. Insert main entity, parent_id → brand
  INSERT INTO public.entities (
    name, type, slug, category_id, description, website_url, image_url,
    parent_id, created_by, user_created, metadata
  ) VALUES (
    _entity_name,
    _entity_type,
    entity_slug,
    _entity_category_id,
    _entity_description,
    _entity_website_url,
    _entity_image_url,
    new_brand.id,
    uid,
    true,
    safe_meta
  )
  RETURNING * INTO new_entity;

  RETURN jsonb_build_object(
    'brand',  to_jsonb(new_brand),
    'entity', to_jsonb(new_entity)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_brand_and_entity_atomic(
  text, text, public.entity_type,
  text, text, text, uuid, text, text, text, jsonb
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.create_brand_and_entity_atomic(
  text, text, public.entity_type,
  text, text, text, uuid, text, text, text, jsonb
) TO authenticated, service_role;
