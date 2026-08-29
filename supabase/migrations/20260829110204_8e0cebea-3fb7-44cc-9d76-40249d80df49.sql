-- Phase 2.3 — atomic, hardened review-subject creation.

-- 1) Identity normalization helper (mirror of normalizeBrandName / brand_normalize.ts).
--    STABLE (not IMMUTABLE): unaccent() is dictionary-dependent, matching the
--    Phase 2.2 slugify_entity_name volatility choice.
--    NOTE: this is ASCII-reducing and CAN return '' (e.g. '東京', '!!!'). Callers
--    MUST treat '' as "no name identity available" and never force-merge on it.
CREATE OR REPLACE FUNCTION public.normalize_identity_name(input_name text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
  SELECT regexp_replace(
    lower(extensions.unaccent(coalesce(input_name, ''))),
    '[^a-z0-9]', '', 'g'
  );
$$;

ALTER FUNCTION public.normalize_identity_name(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.normalize_identity_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_identity_name(text) TO authenticated, service_role;

-- 2) Atomic create-or-resolve for review subjects.
--    SECURITY DEFINER: a privileged persistence boundary, so it enforces the
--    whole creation contract itself. Client-side registry checks protect the UI only.
--    Approval/moderation is NOT set here: the existing entities_enforce_creation
--    trigger owns approval_status/approved_by/rejected_* and forces created_by.
CREATE OR REPLACE FUNCTION public.create_entity_subject(
  p_name        text,
  p_type        text,
  p_parent_id   uuid    DEFAULT NULL,
  p_api_source  text    DEFAULT NULL,
  p_api_ref     text    DEFAULT NULL,
  p_website_url text    DEFAULT NULL,
  p_metadata    jsonb   DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_name         text := btrim(coalesce(p_name, ''));
  v_type         text := lower(btrim(coalesce(p_type, '')));
  -- Blank/whitespace API identity values are ABSENT, never identity keys.
  v_api_source   text := nullif(btrim(coalesce(p_api_source, '')), '');
  v_api_ref      text := nullif(btrim(coalesce(p_api_ref, '')), '');
  v_norm         text;
  v_has_name_id  boolean := false;
  v_parent       record;
  v_existing     record;
  v_lock_key     bigint;
  v_meta         jsonb;
  v_clean_meta   jsonb := '{}'::jsonb;
  v_key          text;
  v_row          public.entities;
  v_web          text := nullif(btrim(coalesce(p_website_url, '')), '');
  -- Types quick-create may produce with no parent in this phase.
  v_standalone   text[] := ARRAY[
    'place','book','movie','tv_show','course','app','game',
    'event','brand','professional','experience','product','others'
  ];
  -- Descriptive metadata keys a caller may contribute. Everything else dropped.
  v_allowed_meta text[] := ARRAY['created_from_url','source_url','notes','cuisine','author'];
BEGIN
  -- Authentication -----------------------------------------------------------
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  -- Input bounds -------------------------------------------------------------
  IF v_name = '' OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
  END IF;
  IF v_api_source IS NOT NULL AND length(v_api_source) > 64 THEN
    RAISE EXCEPTION 'invalid api_source' USING ERRCODE = '22023';
  END IF;
  IF v_api_ref IS NOT NULL AND length(v_api_ref) > 256 THEN
    RAISE EXCEPTION 'invalid api_ref' USING ERRCODE = '22023';
  END IF;
  -- API identity is a PAIR: both fields or neither.
  IF (v_api_source IS NULL) <> (v_api_ref IS NULL) THEN
    RAISE EXCEPTION 'api_source and api_ref must be provided together' USING ERRCODE = '22023';
  END IF;
  IF v_web IS NOT NULL AND length(v_web) > 2048 THEN
    RAISE EXCEPTION 'invalid website_url' USING ERRCODE = '22023';
  END IF;
  IF p_metadata IS NOT NULL AND length(p_metadata::text) > 8192 THEN
    RAISE EXCEPTION 'metadata too large' USING ERRCODE = '22023';
  END IF;

  -- Canonical type -----------------------------------------------------------
  IF v_type NOT IN (
    'movie','book','tv_show','course','app','game','experience','food',
    'product','place','brand','event','service','professional','others'
  ) THEN
    RAISE EXCEPTION 'unsupported entity type: %', v_type USING ERRCODE = '22023';
  END IF;

  -- `service` is not exposed by quick-create in this phase.
  IF v_type = 'service' THEN
    RAISE EXCEPTION 'service subjects cannot be created here' USING ERRCODE = '22023';
  END IF;

  -- Relationship contract ----------------------------------------------------
  IF p_parent_id IS NULL THEN
    IF NOT (v_type = ANY (v_standalone)) THEN
      RAISE EXCEPTION 'type % requires a provider', v_type USING ERRCODE = '22023';
    END IF;
  ELSE
    SELECT id, type::text AS type, is_deleted
      INTO v_parent
      FROM public.entities
     WHERE id = p_parent_id;

    IF v_parent.id IS NULL OR v_parent.is_deleted THEN
      RAISE EXCEPTION 'provider not found' USING ERRCODE = '23503';
    END IF;

    -- Approved offering pairs ONLY (mirrors OFFERING_RELATIONSHIPS).
    IF NOT (
      (v_parent.type = 'place' AND v_type = 'food')
      OR (v_parent.type = 'brand' AND v_type = 'product')
    ) THEN
      RAISE EXCEPTION 'not an allowed provider/offering pair: % -> %',
        v_parent.type, v_type USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Server-owned metadata ----------------------------------------------------
  v_meta := CASE WHEN jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
                 THEN coalesce(p_metadata, '{}'::jsonb) ELSE '{}'::jsonb END;
  FOREACH v_key IN ARRAY v_allowed_meta LOOP
    IF v_meta ? v_key THEN
      v_clean_meta := v_clean_meta || jsonb_build_object(v_key, v_meta -> v_key);
    END IF;
  END LOOP;
  -- Trusted values merged LAST so they can never be overridden.
  v_clean_meta := v_clean_meta || jsonb_build_object('created_from', 'review_form');

  -- Name identity ------------------------------------------------------------
  -- An empty normalization carries NO identity information: '東京' and '大阪'
  -- both reduce to ''. Never lock on it and never resolve by it.
  v_norm := public.normalize_identity_name(v_name);
  v_has_name_id := (v_norm <> '');

  -- Atomic create-or-resolve for offerings with a usable name identity -------
  IF p_parent_id IS NOT NULL AND v_has_name_id THEN
    -- 64-bit lock key over a delimiter-joined identity tuple (digest = pgcrypto,
    -- verified present in the `extensions` schema).
    v_lock_key := ('x' || substr(
      encode(extensions.digest(
        p_parent_id::text || E'\x1f' || v_type || E'\x1f' || v_norm, 'sha256'
      ), 'hex'), 1, 16))::bit(64)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);
  END IF;

  -- Exact identity recheck (same rules as the shared classifier):
  --   1. same (api_source, api_ref) AND same canonical type
  --   2. same normalized website_url AND same canonical type
  --   3. offering: same parent_id + type + NON-EMPTY normalized name
  IF v_api_source IS NOT NULL AND v_api_ref IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.entities
     WHERE is_deleted = false
       AND api_source = v_api_source
       AND api_ref = v_api_ref
     LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      IF v_existing.type::text <> v_type THEN
        RAISE EXCEPTION 'external reference already used by a different type (%)',
          v_existing.type USING ERRCODE = '23505';
      END IF;
      RETURN jsonb_build_object('created', false, 'entity', to_jsonb(v_existing));
    END IF;
  END IF;

  IF v_web IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.entities
     WHERE is_deleted = false
       AND type::text = v_type
       AND lower(regexp_replace(coalesce(website_url, ''), '/+$', ''))
           = lower(regexp_replace(v_web, '/+$', ''))
     LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('created', false, 'entity', to_jsonb(v_existing));
    END IF;
  END IF;

  IF p_parent_id IS NOT NULL AND v_has_name_id THEN
    SELECT * INTO v_existing FROM public.entities
     WHERE is_deleted = false
       AND parent_id = p_parent_id
       AND type::text = v_type
       AND public.normalize_identity_name(name) = v_norm
     LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('created', false, 'entity', to_jsonb(v_existing));
    END IF;
  END IF;

  -- Insert. Slug is produced by the Phase 2.2 trigger; never supplied here.
  INSERT INTO public.entities (name, type, parent_id, api_source, api_ref, website_url, metadata, created_by)
  VALUES (
    v_name,
    v_type::public.entity_type,
    p_parent_id,
    v_api_source,
    v_api_ref,
    v_web,
    v_clean_meta,
    v_uid
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('created', true, 'entity', to_jsonb(v_row));
END;
$$;

ALTER FUNCTION public.create_entity_subject(text, text, uuid, text, text, text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_entity_subject(text, text, uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_entity_subject(text, text, uuid, text, text, text, jsonb) TO authenticated;