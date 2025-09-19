-- Create trigger function for generating slugs on INSERT
CREATE OR REPLACE FUNCTION public.generate_entity_slug_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  parent_slug text;
  base_slug text;
  final_slug text;
  counter integer := 0;
  slug_exists boolean;
BEGIN
  -- Only generate slug if it's NULL or empty
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    RETURN NEW;
  END IF;
  
  -- Generate base slug from name
  base_slug := public.generate_entity_slug(NEW.name);
  
  -- If entity has a parent, get parent slug and create hierarchical slug
  IF NEW.parent_id IS NOT NULL THEN
    SELECT slug INTO parent_slug
    FROM public.entities
    WHERE id = NEW.parent_id AND is_deleted = false;
    
    IF parent_slug IS NOT NULL AND parent_slug != '' THEN
      -- Create hierarchical slug: parent-slug-child-slug
      base_slug := parent_slug || '-' || base_slug;
    END IF;
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

-- Create the BEFORE INSERT trigger
CREATE TRIGGER trigger_generate_entity_slug_on_insert
  BEFORE INSERT ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_entity_slug_on_insert();