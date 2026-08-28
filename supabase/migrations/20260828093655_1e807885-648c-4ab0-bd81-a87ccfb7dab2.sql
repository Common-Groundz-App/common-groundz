CREATE OR REPLACE FUNCTION public.update_entity_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- entity_slug_trigger is (historically) BEFORE INSERT OR UPDATE and sorts
  -- before trigger_generate_entity_slug_on_insert, so without this guard every
  -- INSERT ran slug logic twice and discarded any client-supplied slug.
  -- Creation belongs exclusively to generate_entity_slug_on_insert().
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

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