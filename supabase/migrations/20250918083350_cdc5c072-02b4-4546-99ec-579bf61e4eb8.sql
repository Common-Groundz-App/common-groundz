-- Drop the existing function first to allow parameter name change
DROP FUNCTION IF EXISTS public.generate_entity_slug(text, uuid);

-- Create a table to store old slugs for redirects
CREATE TABLE IF NOT EXISTS public.entity_slug_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    old_slug text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Ensure we don't duplicate history entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_slug_history_unique 
ON public.entity_slug_history(entity_id, old_slug);

-- Create the generate_entity_slug function with depth limitation
CREATE OR REPLACE FUNCTION public.generate_entity_slug(name text, entity_id uuid DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  -- Generate the base slug (remove special characters and convert to lowercase)
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'));
  
  -- Trim any leading or trailing hyphens
  base_slug := trim(both '-' from base_slug);
  
  -- Handle empty slug edge case
  IF base_slug = '' THEN
    base_slug := 'untitled';
  END IF;
  
  -- Check if this entity has a parent and should use hierarchical slugs
  IF entity_id IS NOT NULL THEN
    SELECT parent_id, type INTO parent_id_val, current_type
    FROM public.entities
    WHERE id = entity_id;
    
    IF parent_id_val IS NOT NULL THEN
      SELECT slug, type INTO parent_slug, parent_type
      FROM public.entities
      WHERE id = parent_id_val AND is_deleted = false;
      
      -- Only create hierarchical slugs for brand → product relationships
      -- Limit to depth of 1 to prevent overly long slugs
      IF parent_slug IS NOT NULL AND parent_slug != '' AND
         parent_type = 'brand' AND current_type = 'product' THEN
        base_slug := parent_slug || '-' || base_slug;
      END IF;
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
      AND (entity_id IS NULL OR id != entity_id) -- Exclude current entity when updating
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

-- Update the update_entity_slug trigger function to save old slugs
CREATE OR REPLACE FUNCTION public.update_entity_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update slug if:
  -- 1. Name has changed, OR
  -- 2. Parent relationship has changed, OR  
  -- 3. Slug is null or empty
  IF (OLD.name IS DISTINCT FROM NEW.name) OR 
     (OLD.parent_id IS DISTINCT FROM NEW.parent_id) OR 
     (NEW.slug IS NULL OR NEW.slug = '') THEN
    
    -- Store old slug in history if it's valid and different
    IF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
      INSERT INTO public.entity_slug_history (entity_id, old_slug)
      VALUES (OLD.id, OLD.slug)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Generate new hierarchical slug
    NEW.slug := public.generate_entity_slug(NEW.name, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create a function to preview hierarchical migration changes
CREATE OR REPLACE FUNCTION public.preview_hierarchical_migration()
 RETURNS TABLE(
   entity_id uuid,
   entity_name text,
   entity_type entity_type,
   current_slug text,
   new_slug text,
   parent_name text,
   would_change boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as entity_id,
    e.name as entity_name,
    e.type as entity_type,
    e.slug as current_slug,
    public.generate_entity_slug(e.name, e.id) as new_slug,
    p.name as parent_name,
    (e.slug != public.generate_entity_slug(e.name, e.id)) as would_change
  FROM entities e
  LEFT JOIN entities p ON e.parent_id = p.id
  WHERE e.is_deleted = false 
    AND e.slug IS NOT NULL
    AND e.slug != ''
  ORDER BY would_change DESC, p.name, e.name;
END;
$function$;

-- Create a function to migrate existing entities to hierarchical slugs
CREATE OR REPLACE FUNCTION public.migrate_to_hierarchical_slugs(batch_size integer DEFAULT 50)
 RETURNS TABLE(
   updated_count integer,
   entities_processed text[]
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  entity_record RECORD;
  updated_count_val INTEGER := 0;
  processed_entities text[] := '{}';
  new_slug text;
BEGIN
  -- Find entities that need hierarchical slug updates (limit batch size)
  FOR entity_record IN 
    SELECT e.id, e.name, e.slug, e.type, p.slug as parent_slug, p.type as parent_type
    FROM entities e
    LEFT JOIN entities p ON e.parent_id = p.id
    WHERE e.is_deleted = false 
      AND e.slug IS NOT NULL
      AND e.slug != ''
      AND (e.slug != public.generate_entity_slug(e.name, e.id))
    LIMIT batch_size
  LOOP
    -- Generate hierarchical slug
    new_slug := public.generate_entity_slug(entity_record.name, entity_record.id);
    
    -- Only update if slug would actually change
    IF entity_record.slug != new_slug THEN
      -- Save old slug to history
      INSERT INTO public.entity_slug_history (entity_id, old_slug)
      VALUES (entity_record.id, entity_record.slug)
      ON CONFLICT DO NOTHING;
      
      -- Update the entity
      UPDATE entities 
      SET slug = new_slug, updated_at = now()
      WHERE id = entity_record.id;
      
      updated_count_val := updated_count_val + 1;
      processed_entities := array_append(processed_entities, entity_record.name || ' (' || entity_record.slug || ' → ' || new_slug || ')');
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT updated_count_val, processed_entities;
END;
$function$;