
CREATE OR REPLACE FUNCTION public.update_entity_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Case 1: Name or parent changed -> record history + regenerate slug
  IF (OLD.name IS DISTINCT FROM NEW.name) OR 
     (OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN
      IF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
        INSERT INTO entity_slug_history (entity_id, old_slug)
          VALUES (NEW.id, OLD.slug)
          ON CONFLICT (entity_id, old_slug) DO NOTHING;
      END IF;
      NEW.slug := generate_entity_slug(NEW.name, NEW.id);

  -- Case 2: Slug changed directly to a valid value
  ELSIF (OLD.slug IS DISTINCT FROM NEW.slug)
    AND NEW.slug IS NOT NULL AND NEW.slug != '' THEN
      IF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
        INSERT INTO entity_slug_history (entity_id, old_slug)
          VALUES (NEW.id, OLD.slug)
          ON CONFLICT (entity_id, old_slug) DO NOTHING;
      END IF;
      -- Preserve user's manually-set slug (no overwrite)

  -- Case 3: Slug cleared/emptied -> regenerate from name
  ELSIF (NEW.slug IS NULL OR NEW.slug = '') THEN
      IF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
        INSERT INTO entity_slug_history (entity_id, old_slug)
          VALUES (NEW.id, OLD.slug)
          ON CONFLICT (entity_id, old_slug) DO NOTHING;
      END IF;
      NEW.slug := generate_entity_slug(NEW.name, NEW.id);

  END IF;

  RETURN NEW;
END;
$$;

-- Preserve hardening: revoke direct execution from app roles
REVOKE EXECUTE ON FUNCTION public.update_entity_slug() FROM anon, authenticated;
