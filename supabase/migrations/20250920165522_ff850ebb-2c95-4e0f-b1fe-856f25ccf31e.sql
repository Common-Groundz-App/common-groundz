-- Update the INSERT trigger to avoid concatenating slugs for hierarchical paths
DROP TRIGGER IF EXISTS trigger_generate_entity_slug_on_insert ON public.entities;
DROP FUNCTION IF EXISTS public.generate_entity_slug_on_insert();

-- Create updated trigger function that doesn't concatenate parent slugs
CREATE OR REPLACE FUNCTION public.generate_entity_slug_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
  slug_exists boolean;
BEGIN
  -- Only generate slug if it's NULL or empty
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    RETURN NEW;
  END IF;
  
  -- Generate base slug from name (no parent concatenation)
  base_slug := public.generate_entity_slug(NEW.name);
  
  -- Start with the base slug
  final_slug := base_slug;
  
  -- Check if the slug exists and generate a unique one if needed
  LOOP
    SELECT EXISTS(
      SELECT 1
      FROM public.entities
      WHERE slug = final_slug
      AND is_deleted = false
      AND id != NEW.id -- Skip the current row when checking duplicates
    ) INTO slug_exists;
    
    -- If no conflict, we're done
    IF NOT slug_exists THEN
      NEW.slug := final_slug;
      RETURN NEW;
    END IF;
    
    -- Increment counter and try again
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::text;
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recreate the BEFORE INSERT trigger
CREATE TRIGGER trigger_generate_entity_slug_on_insert
  BEFORE INSERT ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_entity_slug_on_insert();