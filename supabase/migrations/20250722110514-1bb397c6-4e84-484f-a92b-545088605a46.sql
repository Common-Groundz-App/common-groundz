
-- Fix the slug generation to prevent unnecessary changes when updating metadata
-- Update the generate_entity_slug function to exclude current entity from duplicate checks
CREATE OR REPLACE FUNCTION public.generate_entity_slug(name text, current_entity_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
  slug_exists boolean;
BEGIN
  -- Generate the base slug (remove special characters and convert to lowercase)
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));
  
  -- Trim any leading or trailing hyphens
  base_slug := trim(both '-' from base_slug);
  
  -- Handle empty slug edge case
  IF base_slug = '' THEN
    base_slug := 'untitled';
  END IF;
  
  -- Start with the base slug
  final_slug := base_slug;
  
  -- Check if the slug exists and generate a unique one if needed
  LOOP
    SELECT EXISTS(
      SELECT 1
      FROM public.entities
      WHERE slug = final_slug
      AND is_deleted = false
      AND (current_entity_id IS NULL OR id != current_entity_id) -- Exclude current entity
    ) INTO slug_exists;
    
    -- If no conflict, we're done
    IF NOT slug_exists THEN
      RETURN final_slug;
    END IF;
    
    -- Increment counter and try again
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;
END;
$function$;

-- Update the entity slug trigger to only fire when name changes and pass entity ID
CREATE OR REPLACE FUNCTION public.update_entity_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update slug if name actually changed
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    NEW.slug := public.generate_entity_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Add a function to fix existing duplicate slugs
CREATE OR REPLACE FUNCTION public.fix_duplicate_slugs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  entity_record RECORD;
  fixed_count INTEGER := 0;
BEGIN
  -- Find entities with duplicate slugs (excluding the first occurrence)
  FOR entity_record IN 
    WITH duplicate_slugs AS (
      SELECT slug, 
             ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn,
             id, name
      FROM public.entities 
      WHERE slug IS NOT NULL 
        AND is_deleted = false
    )
    SELECT id, name, slug
    FROM duplicate_slugs 
    WHERE rn > 1
  LOOP
    -- Generate a new unique slug for duplicates
    UPDATE public.entities
    SET slug = public.generate_entity_slug(entity_record.name, entity_record.id)
    WHERE id = entity_record.id;
    
    fixed_count := fixed_count + 1;
  END LOOP;
  
  RETURN fixed_count;
END;
$function$;
