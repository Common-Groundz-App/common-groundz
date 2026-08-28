-- Phase 2.2: parent-aware slug foundation

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- Canonical normalization, parity with slugifyEntityName() in TypeScript.
CREATE OR REPLACE FUNCTION public.slugify_entity_name(input_name text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT trim(both '-' FROM
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(public.unaccent(coalesce(input_name, ''))),
          '[^a-z0-9[:space:]-]', '', 'g'
        ),
        '[[:space:]]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$function$;

-- Availability check. entities_slug_key is a GLOBAL unique index with no
-- is_deleted predicate, so soft-deleted rows still reserve their slug and must
-- be counted here; otherwise the generator can hand back a slug the unique
-- index will reject. Historical slugs are reserved too. NULL-safe exclusion.
CREATE OR REPLACE FUNCTION public.entity_slug_is_taken(candidate text, exclude_entity_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.entities e
    WHERE e.slug = candidate
      AND e.id IS DISTINCT FROM exclude_entity_id
  ) OR EXISTS (
    SELECT 1 FROM public.entity_slug_history h
    WHERE h.old_slug = candidate
      AND h.entity_id IS DISTINCT FROM exclude_entity_id
  );
$function$;

-- Parent-aware generator. current_entity_id = self-exclusion, parent_id = qualification.
CREATE OR REPLACE FUNCTION public.generate_entity_slug_v2(
  name text,
  current_entity_id uuid DEFAULT NULL,
  parent_id uuid DEFAULT NULL,
  requested_slug text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
  parent_slug text;
  short_id text;
  supplied text;
BEGIN
  short_id := substr(coalesce(current_entity_id, gen_random_uuid())::text, 1, 8);

  -- Explicit-slug whitespace contract: surrounding whitespace is trimmed,
  -- everything else is preserved literally. Deliberate, and tested.
  supplied := nullif(btrim(coalesce(requested_slug, '')), '');

  -- A non-null parent_id must resolve to a usable namespace, or fail loudly.
  -- Soft-deleted parents still resolve at the slug layer: child URLs are meant
  -- to survive parent deletion, and whether a NEW child may be attached to a
  -- deleted parent is an application-level relationship decision.
  IF generate_entity_slug_v2.parent_id IS NOT NULL THEN
    SELECT nullif(e.slug, '')
      INTO parent_slug
    FROM public.entities e
    WHERE e.id = generate_entity_slug_v2.parent_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot generate slug: parent entity % does not exist', generate_entity_slug_v2.parent_id
        USING ERRCODE = '23503';
    END IF;

    IF parent_slug IS NULL THEN
      RAISE EXCEPTION 'Cannot generate slug: parent entity % has no usable slug', generate_entity_slug_v2.parent_id
        USING ERRCODE = '23502';
    END IF;
  END IF;

  -- Supplied slug on a parentless entity: preserved literally, or rejected.
  IF supplied IS NOT NULL AND parent_slug IS NULL THEN
    IF public.entity_slug_is_taken(supplied, current_entity_id) THEN
      RAISE EXCEPTION 'Slug "%" is already in use by another entity or a historical URL', supplied
        USING ERRCODE = '23505';
    END IF;
    RETURN supplied;
  END IF;

  IF parent_slug IS NOT NULL THEN
    -- An explicit child slug may never be the parent's own namespace.
    IF supplied IS NOT NULL AND supplied = parent_slug THEN
      RAISE EXCEPTION 'Slug "%" is invalid: a child slug cannot equal its parent''s slug', supplied
        USING ERRCODE = '22023';
    END IF;

    -- The stored parent slug is an OPAQUE namespace prefix: never re-slugify it
    -- (a parentless parent may legitimately hold a non-canonical literal slug),
    -- and compare it as a LITERAL prefix -- LIKE would treat _ and % in a
    -- parent slug as wildcards.
    IF supplied IS NOT NULL
       AND left(supplied, length(parent_slug) + 1) = parent_slug || '-' THEN
      base_slug := supplied;                                  -- already qualified
    ELSE
      base_slug := parent_slug || '-' || public.slugify_entity_name(coalesce(supplied, name));
    END IF;

    -- A generated child may never be empty or collapse onto its parent's slug.
    IF base_slug = parent_slug || '-' OR base_slug = parent_slug THEN
      base_slug := parent_slug || '-item-' || short_id;
    END IF;
  ELSE
    base_slug := public.slugify_entity_name(name);
    IF base_slug = '' THEN
      base_slug := 'entity-' || short_id;
    END IF;
  END IF;

  final_slug := base_slug;
  WHILE public.entity_slug_is_taken(final_slug, current_entity_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;

  RETURN final_slug;
END;
$function$;

-- These two helpers are the INTERNAL slug engine, reached only through triggers
-- and other SECURITY DEFINER functions owned by postgres. Postgres grants
-- EXECUTE to PUBLIC on new functions by default; revoke that deliberately so
-- they never become client-callable RPCs.
ALTER FUNCTION public.slugify_entity_name(text) OWNER TO postgres;
ALTER FUNCTION public.entity_slug_is_taken(text, uuid) OWNER TO postgres;
ALTER FUNCTION public.generate_entity_slug_v2(text, uuid, uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.slugify_entity_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.entity_slug_is_taken(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_entity_slug_v2(text, uuid, uuid, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.slugify_entity_name(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.entity_slug_is_taken(text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_entity_slug_v2(text, uuid, uuid, text) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.slugify_entity_name(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.entity_slug_is_taken(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_entity_slug_v2(text, uuid, uuid, text) TO service_role;

-- Legacy overloads become thin wrappers, retained for compatibility.
CREATE OR REPLACE FUNCTION public.generate_entity_slug(name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.generate_entity_slug_v2(name, NULL, NULL, NULL);
$function$;

-- The 2-arg overload must lose its DEFAULT NULL: with a 1-arg overload present
-- the default makes single-argument calls ambiguous (42725 "function is not
-- unique"), which is already reproducible on the live database today. Postgres
-- cannot remove a parameter default via CREATE OR REPLACE, so a drop is
-- required. Verified first: this function has ZERO non-internal pg_depend
-- entries (its six plpgsql callers create no hard dependencies), owner
-- postgres, EXECUTE granted to anon/authenticated/service_role -- all of which
-- are restored explicitly below to match the pre-migration model.
DROP FUNCTION IF EXISTS public.generate_entity_slug(text, uuid);

CREATE FUNCTION public.generate_entity_slug(name text, entity_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.generate_entity_slug_v2(
    name,
    entity_id,
    (SELECT e.parent_id FROM public.entities e WHERE e.id = entity_id),
    NULL
  );
$function$;

ALTER FUNCTION public.generate_entity_slug(text, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.generate_entity_slug(text, uuid) TO anon, authenticated, service_role;

-- Insert trigger: the database is the deliberate authority for creation slugs.
CREATE OR REPLACE FUNCTION public.generate_entity_slug_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.slug := public.generate_entity_slug_v2(
    NEW.name,
    NEW.id,
    NEW.parent_id,
    nullif(NEW.slug, '')
  );
  RETURN NEW;
END;
$function$;

-- Update trigger: implements the branch contract exactly.
CREATE OR REPLACE FUNCTION public.update_entity_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Detach (including FK ON DELETE SET NULL): preserve the child's URL untouched.
  IF OLD.parent_id IS NOT NULL AND NEW.parent_id IS NULL THEN
    NEW.slug := OLD.slug;
    RETURN NEW;
  END IF;

  -- Structural change: name changed, or attached/reparented.
  IF (OLD.name IS DISTINCT FROM NEW.name)
     OR (OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN
    IF OLD.slug IS NOT NULL AND OLD.slug <> '' THEN
      INSERT INTO public.entity_slug_history (entity_id, old_slug)
        VALUES (NEW.id, OLD.slug)
        ON CONFLICT (entity_id, old_slug) DO NOTHING;
    END IF;
    NEW.slug := public.generate_entity_slug_v2(NEW.name, NEW.id, NEW.parent_id, NULL);

  -- Deliberate direct slug edit.
  ELSIF (OLD.slug IS DISTINCT FROM NEW.slug)
        AND NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    IF OLD.slug IS NOT NULL AND OLD.slug <> '' THEN
      INSERT INTO public.entity_slug_history (entity_id, old_slug)
        VALUES (NEW.id, OLD.slug)
        ON CONFLICT (entity_id, old_slug) DO NOTHING;
    END IF;
    NEW.slug := public.generate_entity_slug_v2(NEW.name, NEW.id, NEW.parent_id, NEW.slug);

  -- Slug cleared: regenerate.
  ELSIF (NEW.slug IS NULL OR NEW.slug = '') THEN
    IF OLD.slug IS NOT NULL AND OLD.slug <> '' THEN
      INSERT INTO public.entity_slug_history (entity_id, old_slug)
        VALUES (NEW.id, OLD.slug)
        ON CONFLICT (entity_id, old_slug) DO NOTHING;
    END IF;
    NEW.slug := public.generate_entity_slug_v2(NEW.name, NEW.id, NEW.parent_id, NULL);
  END IF;

  RETURN NEW;
END;
$function$;

-- Cleanup helper must not strip parent qualification from children.
CREATE OR REPLACE FUNCTION public.fix_duplicate_slugs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  entity_record RECORD;
  fixed_count INTEGER := 0;
  new_slug TEXT;
BEGIN
  FOR entity_record IN
    SELECT id, name, slug
    FROM public.entities
    WHERE is_deleted = false
      AND parent_id IS NULL
      AND slug ~ '-[0-9]+$'
    ORDER BY created_at ASC
  LOOP
    new_slug := public.generate_entity_slug_v2(entity_record.name, entity_record.id, NULL, NULL);

    IF new_slug <> entity_record.slug AND NOT (new_slug ~ '-[0-9]+$') THEN
      UPDATE public.entities SET slug = new_slug WHERE id = entity_record.id;
      fixed_count := fixed_count + 1;
    END IF;
  END LOOP;

  RETURN fixed_count;
END;
$function$;