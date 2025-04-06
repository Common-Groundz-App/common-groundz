
-- Function to insert a post entity relationship
CREATE OR REPLACE FUNCTION public.insert_post_entity(p_post_id UUID, p_entity_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.post_entities (post_id, entity_id)
  VALUES (p_post_id, p_entity_id);
EXCEPTION
  WHEN unique_violation THEN
    -- Silently ignore duplicate entries
    RETURN;
END;
$$;

-- Function to get entities for multiple posts
CREATE OR REPLACE FUNCTION public.get_post_entities(post_ids UUID[])
RETURNS TABLE (
  post_id UUID,
  entity_id UUID,
  entity JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.post_id,
    pe.entity_id,
    jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'type', e.type,
      'venue', e.venue,
      'description', e.description,
      'image_url', e.image_url
    ) as entity
  FROM 
    public.post_entities pe
    JOIN public.entities e ON pe.entity_id = e.id
  WHERE 
    pe.post_id = ANY(post_ids)
    AND e.is_deleted = false;
END;
$$;
