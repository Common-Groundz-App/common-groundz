-- Fix entity slug regeneration issue
-- Only regenerate slugs when entity name actually changes

-- Update the generate_entity_slug function to exclude current entity from duplicate checks
CREATE OR REPLACE FUNCTION public.generate_entity_slug(name text, current_entity_id uuid DEFAULT NULL::uuid)
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

-- Create/update the trigger function to only fire when name changes
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

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_update_entity_slug ON public.entities;
CREATE TRIGGER trigger_update_entity_slug
  BEFORE UPDATE ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_entity_slug();

-- Function to fix existing duplicate slugs
CREATE OR REPLACE FUNCTION public.fix_duplicate_slugs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  entity_record RECORD;
  fixed_count INTEGER := 0;
  new_slug TEXT;
BEGIN
  -- Find entities with problematic slugs (containing incremented numbers)
  FOR entity_record IN 
    SELECT id, name, slug
    FROM public.entities
    WHERE is_deleted = false
      AND slug ~ '-[0-9]+$' -- Slugs ending with dash and numbers
    ORDER BY created_at ASC -- Process older entities first
  LOOP
    -- Generate a clean slug for this entity
    new_slug := public.generate_entity_slug(entity_record.name, entity_record.id);
    
    -- Update if the new slug is different and cleaner
    IF new_slug != entity_record.slug AND NOT (new_slug ~ '-[0-9]+$') THEN
      UPDATE public.entities
      SET slug = new_slug
      WHERE id = entity_record.id;
      
      fixed_count := fixed_count + 1;
    END IF;
  END LOOP;
  
  RETURN fixed_count;
END;
$function$;