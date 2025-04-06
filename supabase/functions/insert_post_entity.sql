
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
