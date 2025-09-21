-- Update get_child_entities function to include slug
CREATE OR REPLACE FUNCTION public.get_child_entities(parent_uuid uuid)
 RETURNS TABLE(id uuid, name text, type entity_type, image_url text, description text, slug text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT e.id, e.name, e.type, e.image_url, e.description, e.slug
  FROM public.entities e
  WHERE e.parent_id = parent_uuid AND e.is_deleted = false
  ORDER BY e.name;
END;
$function$