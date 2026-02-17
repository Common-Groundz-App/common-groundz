

# Revised Migration: Slug History Uniqueness Check

## What Changed From Previous Attempt

The previous SQL used `DROP FUNCTION` before recreating `generate_entity_slug(text, uuid)`. This is unnecessary and risky because:

- The existing function uses `entity_id uuid DEFAULT NULL::uuid`
- We are not changing that default -- we only need to update the function body
- `CREATE OR REPLACE` works fine when the signature (including defaults) stays the same
- Dropping a core function mid-migration risks breaking dependent triggers

## Fix

Simply use `CREATE OR REPLACE` for all three functions, preserving `DEFAULT NULL::uuid` on the 2-arg version. No `DROP FUNCTION` statement.

## Migration SQL (Final)

```sql
-- 1. Standalone index for fast history lookups
CREATE INDEX IF NOT EXISTS idx_entity_slug_history_old_slug
ON public.entity_slug_history (old_slug);

-- 2. Update generate_entity_slug(name) - 1 arg
CREATE OR REPLACE FUNCTION public.generate_entity_slug(name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
  slug_exists boolean;
BEGIN
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'untitled';
  END IF;

  final_slug := base_slug;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.entities
      WHERE slug = final_slug AND is_deleted = false
    ) INTO slug_exists;

    IF NOT slug_exists THEN
      SELECT EXISTS(
        SELECT 1 FROM public.entity_slug_history
        WHERE old_slug = final_slug
      ) INTO slug_exists;
    END IF;

    IF NOT slug_exists THEN
      RETURN final_slug;
    END IF;

    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;
END;
$$;

-- 3. Update generate_entity_slug(name, entity_id) - 2 args (DEFAULT preserved)
CREATE OR REPLACE FUNCTION public.generate_entity_slug(name text, entity_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
  slug_exists boolean;
  parent_slug text;
  parent_id_val uuid;
  parent_type entity_type;
  current_type entity_type;
BEGIN
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'untitled';
  END IF;

  IF entity_id IS NOT NULL THEN
    SELECT e.parent_id, e.type INTO parent_id_val, current_type
    FROM public.entities e
    WHERE e.id = generate_entity_slug.entity_id;

    IF parent_id_val IS NOT NULL THEN
      SELECT e.slug, e.type INTO parent_slug, parent_type
      FROM public.entities e
      WHERE e.id = parent_id_val AND e.is_deleted = false;

      IF parent_slug IS NOT NULL AND parent_slug != '' AND
         parent_type = 'brand' AND current_type = 'product' THEN
        base_slug := parent_slug || '-' || base_slug;
      END IF;
    END IF;
  END IF;

  final_slug := base_slug;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.entities
      WHERE slug = final_slug AND is_deleted = false
      AND (generate_entity_slug.entity_id IS NULL OR id != generate_entity_slug.entity_id)
    ) INTO slug_exists;

    IF NOT slug_exists THEN
      SELECT EXISTS(
        SELECT 1 FROM public.entity_slug_history h
        WHERE h.old_slug = final_slug
        AND h.entity_id != generate_entity_slug.entity_id
      ) INTO slug_exists;
    END IF;

    IF NOT slug_exists THEN
      RETURN final_slug;
    END IF;

    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;
END;
$$;

-- 4. Update generate_entity_slug_on_insert()
CREATE OR REPLACE FUNCTION public.generate_entity_slug_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
  slug_exists boolean;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    RETURN NEW;
  END IF;

  base_slug := public.generate_entity_slug(NEW.name);
  final_slug := base_slug;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.entities
      WHERE slug = final_slug AND is_deleted = false
      AND id != NEW.id
    ) INTO slug_exists;

    IF NOT slug_exists THEN
      SELECT EXISTS(
        SELECT 1 FROM public.entity_slug_history
        WHERE old_slug = final_slug
      ) INTO slug_exists;
    END IF;

    IF NOT slug_exists THEN
      NEW.slug := final_slug;
      RETURN NEW;
    END IF;

    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;
END;
$$;
```

## What Does NOT Change

- `update_entity_slug()` trigger -- untouched
- `entity_slug_history` table structure -- untouched
- Frontend code, edge functions, RLS policies -- untouched

## Summary of Differences From Previous Attempt

- No `DROP FUNCTION` statement
- `DEFAULT NULL::uuid` preserved on the 2-arg function
- Everything else (history checks, self-exclusion guard, `pg_temp`, index) remains the same

